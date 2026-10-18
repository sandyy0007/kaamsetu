import { cn, initials } from "@/lib/utils";
import type { UserSummary, VerificationBadgeDTO, VerificationBadgeType } from "@/types/dto";
import { VerificationBadge } from "@/components/features/verification-badge";

const SIZE = { xs: "h-6 w-6 text-[10px]", sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-xl", xl: "h-24 w-24 text-3xl" } as const;

/** Colour-hashed initials avatar (no external image dependency). */
export function Avatar({ name, hue, size = "md", className, ring }: { name: string; hue: number; size?: keyof typeof SIZE; className?: string; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-grid shrink-0 select-none place-items-center rounded-full font-bold text-white", SIZE[size], ring && "ring-2 ring-primary ring-offset-2 ring-offset-background", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 48% 38%), hsl(${(hue + 36) % 360} 52% 30%))` }}
    >
      {initials(name)}
    </span>
  );
}

export function UserAvatar({ user, size = "md", className, ring }: { user: Pick<UserSummary, "name" | "hue">; size?: keyof typeof SIZE; className?: string; ring?: boolean }) {
  return <Avatar name={user.name} hue={user.hue} size={size} className={className} ring={ring} />;
}

/** Verified mark — delegates to distinct category badges with explanation modal. */
export function VerifiedMark({
  badge,
  type,
  label = "Verified",
  size = "sm",
  showLabel = false,
  className,
}: {
  badge?: VerificationBadgeDTO | null;
  type?: VerificationBadgeType;
  label?: string;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const effectiveBadge = badge ?? (label ? { type: type ?? "PROFESSIONAL", label, aboutText: "" } : undefined);
  return <VerificationBadge badge={effectiveBadge} type={type} size={size} showLabel={showLabel} className={className} />;
}
