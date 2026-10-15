"use client";
import Link from "next/link";
import { MapPin, Sprout, Users } from "lucide-react";
import { UserAvatar, VerifiedMark } from "@/components/ui/avatar";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROLE_LABEL } from "@/lib/constants";
import { profileHref } from "@/lib/links";
import { cn, formatCompact, timeAgo } from "@/lib/utils";
import type { BuyerCardDTO, ExpertCardDTO, FarmerCardDTO, OrgCardDTO, UserSummary } from "@/types/dto";
import { FollowButton, MessageButton } from "./actions";

/** Avatar + name + verified tick + secondary line, linking to the person's profile. */
export function UserLine({ user, sub, time, size = "md", className, link = true, showDemo = true }: { user: UserSummary; sub?: string; time?: string; size?: "sm" | "md" | "lg"; className?: string; link?: boolean; showDemo?: boolean }) {
  const inner = (
    <>
      <UserAvatar user={user} size={size} />
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1 font-bold">
          <span className="truncate">{user.name}</span>
          {user.verified && <VerifiedMark label={user.badge ?? "Verified"} />}
          {showDemo && user.isDemo && <DemoBadge className="ml-1" />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {sub ?? user.headline ?? ROLE_LABEL[user.role]}
          {time ? ` · ${timeAgo(time)}` : ""}
        </span>
      </span>
    </>
  );
  return link ? (
    <Link href={profileHref(user)} className={cn("flex min-w-0 items-center gap-3 rounded-xl", className)}>
      {inner}
    </Link>
  ) : (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>{inner}</div>
  );
}

export function FarmerCard({ f }: { f: FarmerCardDTO }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <UserLine user={f.user} sub={f.specialization} />
        <FollowButton userId={f.user.id} following={f.isFollowing ?? false} />
      </div>
      {f.matchReason && <p className="mt-3 rounded-lg bg-primary/8 px-2.5 py-1.5 text-xs font-semibold text-primary">{f.matchReason}</p>}
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" aria-hidden />
          {[f.village, f.district].filter(Boolean).join(", ")}
          {f.distanceKm != null && ` · ~${Math.round(f.distanceKm)} km`}
        </span>
        <span>{f.experienceYears} yrs</span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-4 w-4" aria-hidden />
          {formatCompact(f.followers)}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {f.crops.slice(0, 5).map((c) => (
          <Badge key={c} tone="primary">
            <Sprout className="h-3 w-3" aria-hidden />
            {c}
          </Badge>
        ))}
        {f.fpos.map((p) => (
          <Badge key={p.id} tone="info">
            {p.name}
          </Badge>
        ))}
      </div>
      {f.produce.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">For sale: </span>
          {f.produce.map((p) => `${p.crop} ${p.quantity} ${p.unit.toLowerCase()}`).join(" · ")}
        </p>
      )}
      <div className="mt-auto flex gap-2 pt-4">
        <Link href={profileHref(f.user)} className="tap inline-flex flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
          View profile
        </Link>
        <MessageButton userId={f.user.id} name={f.user.name} context={{ kind: "DIRECT", title: `Message to ${f.user.name}` }} />
      </div>
    </Card>
  );
}

export function BuyerCard({ b }: { b: BuyerCardDTO }) {
  return (
    <Card className="flex flex-col p-4">
      <UserLine user={b.user} sub={b.businessName} />
      <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" aria-hidden />
        {b.district}, {b.state} · {b.industry}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {b.cropsPurchased.slice(0, 6).map((c) => (
          <Badge key={c} tone="accent">
            {c}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="text-sm font-semibold">{b.openRequirements} open requirement{b.openRequirements === 1 ? "" : "s"}</span>
        <Link href={profileHref(b.user)} className="tap inline-flex items-center rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
          View buyer
        </Link>
      </div>
    </Card>
  );
}

export function ExpertCard({ e }: { e: ExpertCardDTO }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <UserLine user={e.user} sub={`${e.category} · ${e.qualification}`} />
        <FollowButton userId={e.user.id} following={e.isFollowing ?? false} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {e.organization} · {e.district}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {e.specialization.slice(0, 4).map((s) => (
          <Badge key={s} tone="success">
            {s}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 text-sm text-muted-foreground">
        <span>
          {e.experienceYears} yrs · {e.answerCount} answers
        </span>
        <Link href={profileHref(e.user)} className="tap inline-flex items-center rounded-xl border px-3 font-semibold text-foreground hover:bg-muted">
          View
        </Link>
      </div>
    </Card>
  );
}

export function OrgCard({ o }: { o: OrgCardDTO }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <UserLine user={o.user} sub={o.kind === "GOVERNMENT" ? (o.department ?? "Organisation") : "FPO / Co-operative"} />
        <FollowButton userId={o.user.id} following={o.isFollowing} />
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{o.about}</p>
      <p className="mt-auto flex items-center gap-3 pt-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-4 w-4" aria-hidden />
          {o.district ?? o.state}
        </span>
        {o.memberCount != null && <span>{o.memberCount} members</span>}
      </p>
    </Card>
  );
}
