import { ChatFeature } from "@/features/Chat";
import { ChatProvider } from "@/features/Chat/ChatProvider";

export default function ChatLayout() {
  return (
    <ChatProvider>
      <ChatFeature />
    </ChatProvider>
  );
}
