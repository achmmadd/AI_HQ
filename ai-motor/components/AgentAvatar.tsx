"use client";

import { Logo, type LogoMotion, type LogoSize } from "@/components/logo";
import { cn } from "@/lib/utils";
import type { WorkspaceId } from "@/lib/types";

const AVATAR_SIZE: Record<"xs" | "sm" | "md" | "lg", LogoSize> = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
};

export type MascotMotion = LogoMotion;

function resolveMotion(
  animated?: boolean,
  motion?: LogoMotion | false,
  chatDefault?: LogoMotion
): LogoMotion | false {
  if (motion) return motion;
  if (motion === false) return false;
  if (animated) return "idle";
  if (chatDefault) return chatDefault;
  return false;
}

type AvatarProps = {
  className?: string;
  animated?: boolean;
  motion?: LogoMotion | false;
  smoke?: boolean;
  thinkingDots?: boolean;
  loadingRing?: boolean;
  size?: LogoSize;
};

function LogoAvatar({
  size = "sm",
  className,
  animated,
  motion,
  loadingRing,
  chatDefault,
}: AvatarProps & { chatDefault?: LogoMotion }) {
  const activeMotion = resolveMotion(animated, motion, chatDefault);

  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
      {loadingRing && activeMotion === "bounce" ? (
        <span className="fumero-mascot-loading-ring" aria-hidden />
      ) : null}
      <Logo
        size={size}
        motion={activeMotion || false}
        decorative
      />
    </span>
  );
}

/** Fumero mascot — central Logo asset with optional motion. */
export function GhostAvatar(props: AvatarProps) {
  return <LogoAvatar {...props} />;
}

/** Chat avatar — same Logo asset, optional chat motion. */
export function SmokeyChatAvatar({
  size = "sm",
  ...props
}: AvatarProps & { size?: keyof typeof AVATAR_SIZE; className?: string }) {
  return (
    <LogoAvatar
      size={AVATAR_SIZE[size]}
      chatDefault="chat"
      {...props}
    />
  );
}

export function AgentAvatar({
  workspace: _workspace,
  size = "md",
  variant = "plain",
  animated = false,
  motion,
  loadingRing,
  className,
}: {
  workspace: WorkspaceId | string;
  size?: keyof typeof AVATAR_SIZE;
  variant?: "plain" | "chat";
  animated?: boolean;
  motion?: LogoMotion | false;
  smoke?: boolean;
  thinkingDots?: boolean;
  loadingRing?: boolean;
  className?: string;
}) {
  const chatDefault = variant === "chat" ? "chat" : undefined;

  return (
    <LogoAvatar
      size={AVATAR_SIZE[size]}
      animated={animated}
      motion={motion}
      loadingRing={loadingRing}
      chatDefault={chatDefault}
      className={className}
    />
  );
}
