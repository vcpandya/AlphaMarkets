import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useChatContext } from "../../contexts/ChatContext";
import { chat } from "../../services/api";

type ExplanationLevel = "eli5" | "standard" | "pro";

const LEVEL_LABELS: Record<ExplanationLevel, string> = {
  eli5: "ELI5",
  standard: "Standard",
  pro: "Pro",
};

const LEVEL_INSTRUCTIONS: Record<ExplanationLevel, string> = {
  eli5: "Explain things in the simplest possible terms, as if talking to a complete beginner. Use analogies and avoid jargon. Keep it short and friendly.",
  standard: "Give clear, balanced explanations suitable for someone with general financial literacy. Use proper terminology but explain complex concepts briefly.",
  pro: "Give detailed, technical explanations assuming deep financial expertise. Use precise terminology, reference specific metrics, and provide nuanced analysis. Include formulas in LaTeX when relevant.",
};

interface FloatingChatProps {
  openRouterKey: string;
  selectedModel: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(context: ReturnType<typeof useChatContext>["context"], level: ExplanationLevel): string {
  let prompt = `You are AlphaMarkets Assistant, a helpful AI that answers questions about the financial analysis displayed on screen. Never use em dashes. You can use markdown formatting, tables, and LaTeX math (wrap inline math in $...$ and display math in $$...$$) when helpful.\n\nExplanation style: ${LEVEL_INSTRUCTIONS[level]}\n\nCurrent context:`;

  const pageDescriptions: Record<string, string> = {
    dashboard: "the Dashboard page",
    settings: "the Settings page",
    "stock-detail": "a stock detail view",
  };
  prompt += `\n- User is viewing: ${pageDescriptions[context.page] || context.page}`;

  if (context.activeTab) {
    prompt += `\n- Active tab: ${context.activeTab}`;
  }

  if (context.results) {
    const r = context.results;
    const parts: string[] = [];
    if (r.qa) parts.push(`Q&A (${r.qa.length} items)`);
    if (r.stocks) parts.push(`Stocks (${r.stocks.length} recommendations)`);
    if (r.graph) parts.push("Impact Graph");
    if (r.causechain) parts.push("Cause Chain");
    if (parts.length > 0) {
      prompt += `\n- Analysis results available: ${parts.join(", ")}`;
    }
  }

  if (context.selectedStock) {
    const s = context.selectedStock;
    prompt += `\n- Viewing detailed analysis for: ${s.ticker} - ${s.company} (${s.signal}, impact ${s.impactScore}/10)`;
    prompt += `\n- Sector: ${s.sector}`;
    if (s.market) prompt += `\n- Market: ${s.market}`;
    if (s.causationChain && s.causationChain.length > 0) {
      prompt += `\n- Causation chain: ${s.causationChain.join(" -> ")}`;
    }
    if (s.reasoning) prompt += `\n- Reasoning: ${s.reasoning}`;
  }

  if (context.stockAnalysis) {
    prompt += `\n- Stock analysis data is loaded for the current view`;
  }

  if (context.tags && context.tags.length > 0) {
    prompt += `\n- Analysis tags: ${context.tags.join(", ")}`;
  }

  if (context.markets && context.markets.length > 0) {
    prompt += `\n- Markets: ${context.markets.join(", ")}`;
  }

  return prompt;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-text-muted animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export function FloatingChat({ openRouterKey, selectedModel }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [level, setLevel] = useState<ExplanationLevel>("standard");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { context } = useChatContext();

  useEffect(() => {
    // Trigger bounce animation on mount
    const timer = setTimeout(() => setHasAnimated(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(context, level);
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await chat(openRouterKey, selectedModel, apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get a response";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, something went wrong: ${errorMessage}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-[70] w-[400px] h-[500px] flex flex-col
            bg-surface-raised border border-border rounded-2xl shadow-2xl shadow-black/40
            animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          {/* Header */}
          <div className="bg-surface-overlay/50 px-4 py-3 border-b border-border rounded-t-2xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">AlphaMarkets Assistant</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="w-10 h-10 text-accent/30 mx-auto mb-3" />
                <p className="text-sm text-text-muted leading-relaxed">
                  Hi! I'm your AlphaMarkets assistant. Ask me anything about the analysis on screen.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap bg-accent/20 text-text-primary rounded-br-md">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed bg-surface-overlay text-text-primary rounded-bl-md chat-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-overlay rounded-2xl rounded-bl-md">
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Level selector + Input bar */}
          <div className="px-3 py-3 border-t border-border shrink-0 space-y-2">
            <div className="flex items-center gap-1">
              {(Object.keys(LEVEL_LABELS) as ExplanationLevel[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    level === l
                      ? "bg-accent/20 text-accent"
                      : "text-text-muted hover:text-text-secondary hover:bg-surface-overlay"
                  }`}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2 text-sm text-text-primary
                  placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent
                  disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-lg bg-accent text-white hover:bg-accent/80 transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-[70] w-14 h-14 rounded-full bg-accent text-white
          shadow-lg shadow-black/30 hover:bg-accent/80 transition-all duration-200
          flex items-center justify-center
          ${!hasAnimated ? "animate-bounce" : ""}`}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative flex items-center justify-center">
            <MessageCircle className="w-7 h-7" />
            <span className="absolute text-[15px] font-semibold leading-none -mt-0.5">α</span>
          </div>
        )}
      </button>
    </>
  );
}
