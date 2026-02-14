import { ChatShell } from "./layout/ChatShell";
import { ChatMain } from "./panel/ChatMain";
import { SessionSidebar } from "./sidebar/SessionSidebar";

export function ChatFeature() {
  return <ChatShell sidebar={<SessionSidebar />} main={<ChatMain />} />;
}
