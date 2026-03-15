/**
 * AgentMail service for sending scheduled analysis results via email.
 *
 * Uses the AgentMail API (https://agentmail.to) to send HTML-formatted
 * analysis reports to configured recipients.
 */

const AGENTMAIL_API = "https://api.agentmail.to/v0";

interface SendEmailParams {
  apiKey: string;
  to: string;
  subject: string;
  htmlBody: string;
  from?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // First, get or create a mailbox to send from
    const fromAddress = params.from || await getOrCreateMailbox(params.apiKey);

    const res = await fetch(`${AGENTMAIL_API}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
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

let cachedMailbox: string | null = null;
let cachedMailboxKey: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getOrCreateMailbox(apiKey: string): Promise<string> {
  if (cachedMailbox && cachedMailboxKey === apiKey && Date.now() - cacheTime < CACHE_TTL) return cachedMailbox;
  // Invalidate on key change
  cachedMailbox = null;
  cachedMailboxKey = apiKey;

  // List existing mailboxes
  const listRes = await fetch(`${AGENTMAIL_API}/mailboxes`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (listRes.ok) {
    const data = await listRes.json() as { mailboxes?: { address: string }[] };
    if (data.mailboxes && data.mailboxes.length > 0) {
      cachedMailbox = data.mailboxes[0].address;
      cacheTime = Date.now();
      return cachedMailbox;
    }
  }

  // Create a new mailbox
  const createRes = await fetch(`${AGENTMAIL_API}/mailboxes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({}),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create AgentMail mailbox: ${createRes.status}`);
  }

  const createData = await createRes.json() as { address: string };
  cachedMailbox = createData.address;
  cacheTime = Date.now();
  return cachedMailbox;
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
          Generated by AlphaMarkets | Powered by AI
        </p>
      </div>
    </body>
    </html>`;

  return { subject, html };
}
