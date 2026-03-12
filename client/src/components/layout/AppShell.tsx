import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatContextProvider } from "../../contexts/ChatContext";
import { FloatingChat } from "../chat/FloatingChat";
import { useSettings } from "../../hooks/useSettings";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/settings": "Settings",
};

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { openRouterKey, selectedModel } = useSettings();
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || "AlphaMarkets";

  return (
    <ChatContextProvider>
      <div className="flex h-screen overflow-hidden bg-surface">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar title={title} onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
        <FloatingChat openRouterKey={openRouterKey} selectedModel={selectedModel} />
      </div>
    </ChatContextProvider>
  );
}
