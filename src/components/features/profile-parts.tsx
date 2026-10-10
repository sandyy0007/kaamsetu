"use client";
import { Ban, Check, Clock, EyeOff, Link2, MoreHorizontal, Pencil, UserPlus, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Scene } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { UserAvatar, VerifiedMark } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover } from "@/components/ui/popover";
import { useInvalidate } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/constants";
import { cn, formatCompact } from "@/lib/utils";
import type { SceneKind } from "@/types/domain";
import type { ConnectionState, UserSummary } from "@/types/dto";
import { FollowButton, MessageButton, ReportButton, SaveButton, ShareButton } from "./actions";

export function ConnectButton({ userId, state, size = "sm" }: { userId: string; state: ConnectionState; size?: "sm" | "md" }) {
  const [s, setS] = useState(state);
  const toast = useToast();
  const invalidate = useInvalidate();
  const act = async () => {
    try {
      if (s === "NONE") {
        await api("POST", `/connections/${userId}`);
        setS("PENDING_SENT");
        toast({ title: "Connection request sent" });
      } else if (s === "PENDING_RECEIVED") {
        await api("POST", `/connections/${userId}/accept`);
        setS("CONNECTED");
        toast({ title: "You are now connected" });
      } else {
        await api("DELETE", `/connections/${userId}`);
        setS("NONE");
        toast({ title: s === "CONNECTED" ? "Connection removed" : "Request cancelled" });
      }
      void invalidate("/farmers", "/connections", "/buyers");
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update connection", description: e instanceof Error ? e.message : undefined });
    }
  };
  const label = { NONE: "Connect", PENDING_SENT: "Requested", PENDING_RECEIVED: "Accept request", CONNECTED: "Connected" }[s];
  const Icon = { NONE: UserPlus, PENDING_SENT: Clock, PENDING_RECEIVED: Check, CONNECTED: Link2 }[s];
  return (
    <Button size={size} variant={s === "NONE" || s === "PENDING_RECEIVED" ? "accent" : "outline"} onClick={act} aria-label={s === "CONNECTED" ? "Connected — click to remove" : s === "PENDING_SENT" ? "Requested — click to cancel" : label}>
      <Icon className="h-4 w-4" /> {label}
    </Button>
  );
}

function MoreMenu({ user }: { user: UserSummary }) {
  const toast = useToast();
  const router = useRouter();
  const block = async (kind: "BLOCK" | "MUTE") => {
    try {
      await api("POST", "/me/blocks", { targetId: user.id, kind });
      toast({ title: kind === "BLOCK" ? `${user.name} blocked` : `${user.name} muted` });
      if (kind === "BLOCK") router.push("/home");
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update", description: e instanceof Error ? e.message : undefined });
    }
  };
  return (
    <Popover
      label="More actions"
      trigger={({ toggle, props }) => (
        <Button variant="outline" size="icon" onClick={toggle} {...props} aria-label="More actions">
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      )}
    >
      {(close) => (
        <div className="text-sm">
          <button onClick={() => { close(); void block("MUTE"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold hover:bg-muted">
            <EyeOff className="h-4 w-4 text-muted-foreground" /> Mute (hide their posts)
          </button>
          <button onClick={() => { close(); void block("BLOCK"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-semibold text-danger hover:bg-muted">
            <Ban className="h-4 w-4" /> Block
          </button>
          <div className="px-1">
            <ReportButton targetType="USER" targetId={user.id} label="Report this profile" className="w-full justify-start !px-2 py-2" />
          </div>
        </div>
      )}
    </Popover>
  );
}

export function ProfileHeader({ user, scene, subtitle, location, stats, isSelf, actions, extraBadges, sharePath, editHref = "/profile/edit", roleLabel }: { user: UserSummary; scene: SceneKind; subtitle?: string; location?: string; stats?: { label: string; value: number | string; href?: string }[]; isSelf: boolean; actions?: ReactNode; extraBadges?: ReactNode; sharePath?: string; editHref?: string; roleLabel?: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-32 md:h-44">
        <Scene kind={scene} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>
      <div className="px-4 pb-4 md:px-6 md:pb-5">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 md:-mt-14">
          <UserAvatar user={user} size="xl" className="ring-4 ring-card" />
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {isSelf ? (
              <>
                <ButtonLink href={editHref} variant="outline" size="sm">
                  <Pencil className="h-4 w-4" /> Edit Profile
                </ButtonLink>
                {sharePath && (
                  <span className="inline-flex items-center rounded-xl border">
                    <ShareButton title={`${user.name} on KaamSetu`} path={sharePath} className="!h-9 gap-1.5 [&_svg]:h-4 [&_svg]:w-4" label="Share Profile" />
                  </span>
                )}
                <ButtonLink href="/settings#privacy" variant="ghost" size="sm">
                  Privacy
                </ButtonLink>
              </>
            ) : (
              <>
                {actions}
                {sharePath && (
                  <span className="inline-flex items-center rounded-xl border">
                    <ShareButton title={`${user.name} on KaamSetu`} path={sharePath} className="!h-9 [&_svg]:h-4 [&_svg]:w-4" />
                  </span>
                )}
                <MoreMenu user={user} />
              </>
            )}
          </div>
        </div>
        <div className="mt-3">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl md:text-3xl">
            {user.name}
            {user.verified && <VerifiedMark label={user.badge ?? "Verified"} className="[&_svg]:h-6 [&_svg]:w-6" />}
            {user.isDemo && <DemoBadge />}
          </h1>
          {subtitle && <p className="mt-0.5 text-base text-foreground/85">{subtitle}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Badge tone={user.verified ? "info" : "neutral"}>{user.verified ? (user.badge ?? "Verified") : (roleLabel ?? ROLE_LABEL[user.role])}</Badge>
            {location && <span>{location}</span>}
            {extraBadges}
          </p>
        </div>
        {stats && stats.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {stats.map((s) => (
              <div key={s.label} className="min-w-[4.5rem]">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                <dd className="text-xl font-extrabold tabular-nums">{typeof s.value === "number" ? formatCompact(s.value) : s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Card>
  );
}

export function PersonActions({ user, following, saved, connection, saveType }: { user: UserSummary; following: boolean; saved?: boolean; connection?: ConnectionState; saveType?: "FARMER" | "PROFESSIONAL" }) {
  return (
    <>
      <FollowButton userId={user.id} following={following} size="md" />
      {connection && <ConnectButton userId={user.id} state={connection} size="md" />}
      <MessageButton userId={user.id} name={user.name} size="md" context={{ kind: "DIRECT", title: `Message to ${user.name}` }} />
      {saveType && saved !== undefined && <SaveButton targetType={saveType} targetId={user.id} saved={saved} className="rounded-xl border" />}
    </>
  );
}

export function Section({ title, children, action, className, id }: { title: string; children: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  return (
    <Card className={cn("p-4 md:p-5", className)} aria-labelledby={id}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={id} className="text-lg">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function TagList({ items, tone = "primary" }: { items: string[]; tone?: "primary" | "accent" | "neutral" | "success" | "info" }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing added yet.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i}>
          <Badge tone={tone} className="px-3 py-1 text-sm">
            {i}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function BlockedNotice() {
  return (
    <Card className="p-8 text-center">
      <UserX className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="font-bold">This profile isn&apos;t available</p>
      <Link href="/home" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">
        Back to Home
      </Link>
    </Card>
  );
}
