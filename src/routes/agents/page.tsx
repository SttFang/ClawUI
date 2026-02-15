import { AgentsFeature } from "@/features/Agents";
import { RescueLayout } from "@/features/RescueAgent";

export default function AgentsPage() {
  return (
    <RescueLayout>
      <AgentsFeature />
    </RescueLayout>
  );
}
