import type { ReactNode } from "react";

export function ChatShell(props: { sidebar: ReactNode; main: ReactNode }) {
  const { sidebar, main } = props;
  return (
    <div className="flex h-full min-h-0">
      {sidebar}
      {main}
    </div>
  );
}
