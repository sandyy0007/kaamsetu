"use client";
import { Bell, Bot, Briefcase, Wrench, Calendar, CheckCheck, CloudSun, GraduationCap, Heart, Landmark, MessageCircle, MessageSquare, ShoppingBasket, Sprout, Stethoscope, UserPlus, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { ChipRow } from "@/components/ui/tabs";
import { useInfiniteList, useInvalidate } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationType } from "@/types/domain";
import type { NotificationDTO, Page } from "@/types/dto";

const ICON: Record<NotificationType, LucideIcon> = {
  GOVERNMENT: Landmark,
  EVENT: Calendar,
  ENQUIRY: MessageSquare,
  EXPERT: Stethoscope,
  COMMUNITY: Users,
  CROP: Sprout,
  LEARNING: GraduationCap,
  MARKET: ShoppingBasket,
  WEATHER: CloudSun,
  FOLLOW: UserPlus,
  COMMENT: MessageCircle,
  LIKE: Heart,
  AI: Bot,
  SERVICE: Wrench,
  WORK: Briefcase,
};
const FILTERS = ["MARKET", "ENQUIRY", "GOVERNMENT", "EVENT", "EXPERT", "COMMUNITY", "WEATHER", "FOLLOW", "COMMENT", "LIKE"] as const;
const LABEL: Record<string, string> = { MARKET: "Market", ENQUIRY: "Enquiries", GOVERNMENT: "Schemes", EVENT: "Events", EXPERT: "Experts", COMMUNITY: "Communities", WEATHER: "Weather", FOLLOW: "Followers", COMMENT: "Comments", LIKE: "Likes" };

export function NotificationsView() {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [type, setType] = useState<"" | (typeof FILTERS)[number]>("");
  const [markingAll, setMarkingAll] = useState(false);
  const q = useInfiniteList<NotificationDTO>("/notifications", { type: type || undefined });
  const pages = q.data?.pages as (Page<NotificationDTO> & { unread: number })[] | undefined;
  const items = pages?.flatMap((p) => p.items) ?? [];
  const unread = pages?.[0]?.unread ?? 0;

  const open = async (n: NotificationDTO) => {
    if (!n.read) {
      try {
        await api("POST", "/notifications/read", { ids: [n.id] });
        await invalidate("/notifications", "/auth/me", "/home");
      } catch (err) {
        console.warn("[KaamSetu:Notifications] Failed to mark notification read:", err);
      }
    }
    router.push(n.link || "/home");
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api("POST", "/notifications/read", { all: true });
      await invalidate("/notifications", "/auth/me", "/home");
    } catch (err) {
      console.warn("[KaamSetu:Notifications] Failed to mark all read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          <Button variant="outline" disabled={!unread || markingAll} onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />
      <div className="mb-4">
        <ChipRow label="Filter notifications" items={FILTERS} value={type} onChange={setType} all="All" />
      </div>
      {q.isLoading ? (
        <ListSkeleton count={5} />
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>
      ) : !items.length ? (
        <Card><EmptyState icon={<Bell className="h-7 w-7" />} title={type ? `No ${LABEL[type]?.toLowerCase()} notifications` : "No notifications yet"} description="Mandi alerts, enquiries, scheme updates and replies will show up here. You can choose which ones in Settings." action={{ label: "Notification settings", href: "/settings#notifications" }} /></Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {items.map((n) => {
              const Icon = ICON[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => open(n)} className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60", !n.read && "bg-primary/5")}>
                    <span className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl", n.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary")}>
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.read ? "font-semibold" : "font-bold")}>{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.body}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                        {n.isDemo ? " · DEMO" : ""}
                      </span>
                    </span>
                    {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <LoadMore hasMore={!!q.hasNextPage} loading={q.isFetchingNextPage} onLoad={() => void q.fetchNextPage()} />
    </div>
  );
}
