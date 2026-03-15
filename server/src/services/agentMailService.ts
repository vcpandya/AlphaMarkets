/**
 * AgentMail service for sending and receiving emails.
 *
 * Uses the Replit AgentMail connector (via @replit/connectors-sdk) for auth,
 * which handles identity and token refresh automatically.
 * Falls back to direct API key auth if the connector is unavailable.
 *
 * Fixed sender mailbox: omni@agentmail.to
 */

import { ReplitConnectors } from "@replit/connectors-sdk";

const FROM_ADDRESS = "omni@agentmail.to";
const AGENTMAIL_API = "https://api.agentmail.to/v0";

async function agentMailFetch(path: string, options: RequestInit = {}): Promise<Response> {
  // Try Replit connector first (handles auth automatically)
  try {
    const connectors = new ReplitConnectors();
    return await connectors.proxy("agentmail", path, {
      method: (options.method as string) || "GET",
      ...(options.body ? { body: options.body as string } : {}),
      ...(options.headers ? { headers: options.headers as Record<string, string> } : {}),
    }) as unknown as Response;
  } catch {
    // Fall back to direct API key auth
    const apiKey = process.env.AGENTMAIL_API_KEY || process.env.AGENTMAIL_KEY;
    if (!apiKey) throw new Error("AgentMail: no connector and no AGENTMAIL_API_KEY set");
    return fetch(`${AGENTMAIL_API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(options.headers as Record<string, string> || {}),
      },
    });
  }
}

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  from?: string;
  apiKey?: string; // optional, only used when connector is unavailable
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const fromAddress = params.from || FROM_ADDRESS;

    const res = await agentMailFetch("/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to: [params.to],
        subject: params.subject,
        html: params.htmlBody,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `AgentMail API error (${res.status}): ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

export interface InboxMessage {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  receivedAt: string;
}

export async function listInbox(limit = 20): Promise<{ messages: InboxMessage[]; error?: string }> {
  try {
    const res = await agentMailFetch(`/mailboxes/${encodeURIComponent(FROM_ADDRESS)}/messages?limit=${limit}`);
    if (!res.ok) {
      const body = await res.text();
      return { messages: [], error: `AgentMail API error (${res.status}): ${body}` };
    }
    const data = await res.json() as { messages?: InboxMessage[] };
    return { messages: data.messages || [] };
  } catch (err) {
    return {
      messages: [],
      error: err instanceof Error ? err.message : "Unknown error listing inbox",
    };
  }
}

export async function getMessage(messageId: string): Promise<{ message: InboxMessage | null; error?: string }> {
  try {
    const res = await agentMailFetch(`/mailboxes/${encodeURIComponent(FROM_ADDRESS)}/messages/${messageId}`);
    if (!res.ok) {
      const body = await res.text();
      return { message: null, error: `AgentMail API error (${res.status}): ${body}` };
    }
    const message = await res.json() as InboxMessage;
    return { message };
  } catch (err) {
    return {
      message: null,
      error: err instanceof Error ? err.message : "Unknown error fetching message",
    };
  }
}

export async function replyToMessage(messageId: string, htmlBody: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await agentMailFetch(`/mailboxes/${encodeURIComponent(FROM_ADDRESS)}/messages/${messageId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlBody }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `AgentMail API error (${res.status}): ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error replying to message",
    };
  }
}

export function formatAnalysisEmail(schedule: {
  name: string;
  tags: string[];
  markets: string[];
}, results: {
  qa?: unknown[];
  stocks?: unknown[];
}): { subject: string; html: string } {
  const subject = `AlphaMarkets Report: ${schedule.name} - ${new Date().toLocaleDateString()}`;

  const qaSection = results.qa && Array.isArray(results.qa)
    ? results.qa.map((item: unknown) => {
        const q = item as { question: string; answer: string; confidence: string };
        return `
          <div style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 3px solid ${
            q.confidence === "high" ? "#10b981" : q.confidence === "medium" ? "#f59e0b" : "#ef4444"
          };">
            <p style="margin: 0 0 8px; font-weight: 600; color: #1f2937;">${q.question}</p>
            <p style="margin: 0; color: #4b5563; font-size: 14px;">${q.answer}</p>
          </div>`;
      }).join("")
    : "";

  const stocksSection = results.stocks && Array.isArray(results.stocks)
    ? `<table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">Ticker</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">Company</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">Signal</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">Impact</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #6b7280;">Rarity</th>
          </tr>
        </thead>
        <tbody>
          ${results.stocks.map((s: unknown) => {
            const stock = s as { ticker: string; company: string; signal: string; impactScore: number; rarity?: string; reasoning: string };
            const signalColor = stock.signal === "bullish" ? "#10b981" : stock.signal === "bearish" ? "#ef4444" : "#6b7280";
            return `<tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 12px; font-weight: 600; font-family: monospace;">${stock.ticker}</td>
              <td style="padding: 8px 12px; font-size: 13px;">${stock.company}</td>
              <td style="padding: 8px 12px;"><span style="color: ${signalColor}; font-weight: 600; text-transform: uppercase; font-size: 12px;">${stock.signal}</span></td>
              <td style="padding: 8px 12px; font-weight: 600;">${stock.impactScore}/10</td>
              <td style="padding: 8px 12px; font-size: 12px;">${stock.rarity || "-"}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px; color: #1f2937;">
      <div style="text-align: center; padding: 24px 0; border-bottom: 2px solid #6366f1;">
        <h1 style="margin: 0; font-size: 22px; color: #6366f1;">AlphaMarkets</h1>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Scheduled Analysis Report</p>
      </div>

      <div style="padding: 20px 0;">
        <h2 style="font-size: 18px; margin: 0 0 4px;">${schedule.name}</h2>
        <p style="margin: 0; color: #6b7280; font-size: 13px;">
          Topics: ${schedule.tags.join(", ")} | Markets: ${schedule.markets.join(", ")} | ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      ${qaSection ? `
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 16px; color: #374151; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Expert Q&A</h3>
          ${qaSection}
        </div>
      ` : ""}

      ${stocksSection ? `
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 16px; color: #374151; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Stocks to Watch</h3>
          ${stocksSection}
        </div>
      ` : ""}

      <div style="padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          Generated by AlphaMarkets | Powered by AI | Sent from ${FROM_ADDRESS}
        </p>
      </div>
    </body>
    </html>`;

  return { subject, html };
}
