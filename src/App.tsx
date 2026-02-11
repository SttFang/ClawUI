import { Outlet } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { StartupGuard } from "@/components/StartupGuard";
import { initChatStreamListener } from "@/store/chat";
import { initChatRunsListener } from "@/store/chatRuns";
import { initExecApprovalsListener } from "@/store/execApprovals";
import { initGatewayIpcListener } from "@/store/gateway";
import { initTheme } from "@/store/ui";

// Initialize IPC listeners and theme once
initGatewayIpcListener();
initChatStreamListener();
initChatRunsListener();
initExecApprovalsListener();
initTheme();

function App() {
  // Gateway startup and WebSocket connection are now handled by StartupGuard
  // after OpenClaw installation check completes
  return (
    <StartupGuard>
      <AppShell>
        <Outlet />
      </AppShell>
    </StartupGuard>
  );
}

export default App;
