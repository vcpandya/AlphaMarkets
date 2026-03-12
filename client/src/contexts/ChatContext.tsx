import { createContext, useContext, useState, type ReactNode } from "react";
import type { AnalysisResults, StockRecommendation } from "../types";
import type { FundamentalAnalysis, TechnicalAnalysis } from "../hooks/useStockAnalysis";

interface ChatContextData {
  page: string; // "dashboard" | "settings" | "stock-detail"
  activeTab?: string; // "qa" | "stocks" | "graph" | "fundamental" | "technical"
  results?: AnalysisResults | null;
  selectedStock?: StockRecommendation | null;
  stockAnalysis?: FundamentalAnalysis | TechnicalAnalysis | null;
  tags?: string[];
  markets?: string[];
}

interface ChatContextValue {
  context: ChatContextData;
  setContext: (data: Partial<ChatContextData>) => void;
}

const ChatCtx = createContext<ChatContextValue>({
  context: { page: "dashboard" },
  setContext: () => {},
});

export function ChatContextProvider({ children }: { children: ReactNode }) {
  const [context, setContextState] = useState<ChatContextData>({ page: "dashboard" });

  function setContext(data: Partial<ChatContextData>) {
    setContextState((prev) => ({ ...prev, ...data }));
  }

  return (
    <ChatCtx.Provider value={{ context, setContext }}>
      {children}
    </ChatCtx.Provider>
  );
}

export function useChatContext() {
  return useContext(ChatCtx);
}
