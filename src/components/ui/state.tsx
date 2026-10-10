"use client";
import { AlertTriangle, Inbox, Lock, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ApiClientError } from "@/lib/api";
import { Button, ButtonLink } from "./button";
import { Card } from "./card";
import { ListSkeleton } from "./skeleton";

export function EmptyState({ title, description, action, icon, compact }: { title: string; description?: string; action?: { label: string; href?: string; onClick?: () => void }; icon?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-4 py-8" : "px-6 py-14"}`}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon ?? <Inbox className="h-7 w-7" aria-hidden />}</div>
      <h3 className="text-lg">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <ButtonLink href={action.href}>{action.label}</ButtonLink>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error?: unknown; onRetry?: () => void; title?: string }) {
  const e = error instanceof ApiClientError ? error : null;
  const forbidden = e?.status === 403;
  const missing = e?.status === 404;
  const Icon = forbidden ? Lock : missing ? SearchX : AlertTriangle;
  const heading = title ?? (forbidden ? "You don't have access to this" : missing ? "We couldn't find that" : "Something went wrong");
  const msg = e?.message ?? "Please check your connection and try again.";
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-danger/12 text-danger">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <h3 className="text-lg">{heading}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{msg}</p>
      {onRetry && !forbidden && !missing && (
        <Button className="mt-5" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
      {(forbidden || missing) && (
        <ButtonLink className="mt-5" variant="outline" href="/home">
          Back to Home
        </ButtonLink>
      )}
    </div>
  );
}

/**
 * Renders loading skeletons / error + retry / empty state / content for a query.
 * `isEmpty` decides emptiness from the data so each page controls its own empty copy.
 */
export function QueryBoundary<T>({ query, children, skeleton, empty, isEmpty }: { query: Pick<UseQueryResult<T, unknown>, "data" | "isLoading" | "isError" | "error" | "refetch">; children: (data: T) => ReactNode; skeleton?: ReactNode; empty?: ReactNode; isEmpty?: (d: T) => boolean }) {
  if (query.isLoading) return <>{skeleton ?? <ListSkeleton />}</>;
  if (query.isError) {
    return (
      <Card>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Card>
    );
  }
  if (query.data === undefined || query.data === null) return <>{empty ?? null}</>;
  if (isEmpty?.(query.data)) return <Card>{empty}</Card>;
  return <>{children(query.data)}</>;
}
