import { cn } from "@/lib/utils";

interface PixelAvatarProps {
  agentId: string;
  className?: string;
}

/**
 * Pixel art avatar for an agent.
 * Currently renders a CSS-based placeholder sprite.
 * TODO: Replace with actual sprite sheet from resources/sprites/agent-avatar.png
 */
export function PixelAvatar({ agentId, className }: PixelAvatarProps) {
  // Derive a stable hue from agentId for visual variety
  const hue = hashToHue(agentId);

  return (
    <div
      className={cn("relative flex items-center justify-center", "w-24 h-24", className)}
      style={{ imageRendering: "pixelated" as React.CSSProperties["imageRendering"] }}
    >
      {/* CSS pixel art placeholder — 8×8 grid scaled up */}
      <svg viewBox="0 0 8 8" width={96} height={96} className="[image-rendering:pixelated]">
        {/* Body */}
        <rect x={3} y={0} width={2} height={1} fill={`hsl(${hue}, 60%, 50%)`} />
        <rect x={2} y={1} width={4} height={1} fill={`hsl(${hue}, 60%, 50%)`} />
        {/* Face */}
        <rect x={2} y={2} width={4} height={2} fill={`hsl(${hue}, 40%, 75%)`} />
        {/* Eyes */}
        <rect x={3} y={2} width={1} height={1} fill="#333" />
        <rect x={5} y={2} width={1} height={1} fill="#333" />
        {/* Torso */}
        <rect x={2} y={4} width={4} height={2} fill={`hsl(${hue}, 50%, 45%)`} />
        <rect x={1} y={4} width={1} height={2} fill={`hsl(${hue}, 50%, 45%)`} />
        <rect x={6} y={4} width={1} height={2} fill={`hsl(${hue}, 50%, 45%)`} />
        {/* Legs */}
        <rect x={2} y={6} width={2} height={2} fill={`hsl(${hue}, 30%, 35%)`} />
        <rect x={4} y={6} width={2} height={2} fill={`hsl(${hue}, 30%, 35%)`} />
      </svg>
    </div>
  );
}

function hashToHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return ((h % 360) + 360) % 360;
}
