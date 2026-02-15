import type { ReactNode } from "react";

export function ChatShell(props: { sidebar: ReactNode; main: ReactNode; panel?: ReactNode }) {
  const { sidebar, main, panel } = props;
  return (
    <div className="flex h-full min-h-0">
      {sidebar}
      {main}
      {panel}
    </div>
  );
}
