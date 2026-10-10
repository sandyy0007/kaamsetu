"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ChevronDown, Handshake, MapPin, Package, Plus, ShoppingBasket } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Scene } from "@/components/art/scene";
import { useToast } from "@/components/providers/toast";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader, SectionHeader, Notice, Stat } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { ServicesList, WorkList } from "./work-opportunities";
import { flatten, useGet, useInfiniteList, useSend } from "@/hooks/use-api";
import { useMe } from "@/hooks/use-me";
import { ApiClientError, api } from "@/lib/api";
import { roleCan } from "@/lib/capabilities";
import { CROPS } from "@/lib/constants";
import { sceneForCrop } from "@/lib/crop-scene";
import { DISTRICT_NAMES } from "@/lib/geo";
import { cn, formatINR, formatShortDate, pluralize, timeAgo, unitLabel } from "@/lib/utils";
import type { EnquiryDTO, ListingCardDTO, ListingDetailDTO, MachineryDTO, MatchDTO, RequirementDTO } from "@/types/dto";
import { MACHINERY_TYPES } from "@/types/domain";
import { MessageButton, ReportButton, SaveButton, ShareButton } from "./actions";
import { MachineryCard, ListingCard, RequirementCard } from "./cards";
import { FilterPanel, SearchField, ToggleChip, useDebounced } from "./filters";
import { FarmerCard, UserLine } from "./people";

type Tab = "produce" | "services" | "equipment" | "opportunities" | "requirements" | "enquiries";
const TABS: Tab[] = ["produce", "services", "equipment", "opportunities", "requirements", "enquiries"];

// ───────── Produce tab ─────────
function ProduceTab() {
  const me = useMe().data;
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [crop, setCrop] = useState(sp.get("crop") ?? "");
  const [district, setDistrict] = useState("");
  const [sort, setSort] = useState("relevance");
  const [minQty, setMinQty] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [organic, setOrganic] = useState(false);
  const [verified, setVerified] = useState(false);
  const [fpo, setFpo] = useState(false);
  const [mine, setMine] = useState(false);
  const dq = useDebounced(q);
  const dMin = useDebounced(minQty);
  const dMax = useDebounced(maxPrice);
  const list = useInfiniteList<ListingCardDTO>("/listings", { q: dq, crop, district, sort, minQty: dMin, maxPrice: dMax, organic: organic ? "1" : "", verified: verified ? "1" : "", fpo: fpo ? "1" : "", mine: mine ? "1" : "" });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  const active = [crop, district, minQty, maxPrice, organic, verified, fpo].filter(Boolean).length;
  const clear = () => {
    setCrop("");
    setDistrict("");
    setMinQty("");
    setMaxPrice("");
    setOrganic(false);
    setVerified(false);
    setFpo(false);
  };
  const canList = !!me && roleCan(me.role, "listing:create");
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchField value={q} onChange={setQ} label="Search produce" placeholder="Search crop, variety or place" />
        </div>
        {canList && <ToggleChip on={mine} onChange={setMine}>My listings</ToggleChip>}
      </div>
      <FilterPanel activeCount={active} onClear={clear}>
        <Select aria-label="Crop" value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="">Any crop</option>
          {CROPS.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">Any district</option>
          {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <Input type="number" min={0} inputMode="numeric" aria-label="Minimum quantity in quintal" placeholder="Min. quintal" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
        <Input type="number" min={0} inputMode="numeric" aria-label="Maximum price per quintal" placeholder="Max ₹ / quintal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <div className="flex flex-wrap gap-2 sm:col-span-2 md:col-span-3">
          <ToggleChip on={organic} onChange={setOrganic}>Organic</ToggleChip>
          <ToggleChip on={verified} onChange={setVerified}>Verified farmer</ToggleChip>
          <ToggleChip on={fpo} onChange={setFpo}>FPO lots</ToggleChip>
        </div>
        <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="relevance">Best match</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="qty">Largest quantity</option>
        </Select>
      </FilterPanel>
      {list.isLoading ? (
        <ListSkeleton count={6} media />
      ) : list.isError ? (
        <Card><ErrorState error={list.error} onRetry={() => void list.refetch()} /></Card>
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={<ShoppingBasket className="h-7 w-7" />}
            title={mine ? "You haven't listed produce yet" : "No produce matches"}
            description={mine ? "List your harvest so verified buyers can find you." : "Clear a filter or try another crop or district."}
            action={mine && canList ? { label: "List produce", href: "/create?type=produce" } : active ? { label: "Clear filters", onClick: clear } : undefined}
          />
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">{pluralize(list.data?.pages[0]?.total ?? items.length, "listing")}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((l) => <ListingCard key={l.id} l={l} />)}
          </div>
          <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
        </>
      )}
    </div>
  );
}

// ───────── Requirements tab ─────────
function MatchesPanel({ r }: { r: RequirementDTO }) {
  const q = useGet<MatchDTO[]>(`/requirements/${r.id}/matches`);
  if (q.isLoading) return <div className="p-4"><ListSkeleton count={2} /></div>;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data?.length) return <p className="p-4 text-sm text-muted-foreground">No matching produce yet. Farmers with {r.crop} near {r.district} will be notified.</p>;
  return (
    <ul className="divide-y">
      {q.data.map((m) => (
        <li key={m.listing.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={m.score >= 70 ? "success" : "warning"}>{m.score}% match</Badge>
              <Link href={`/market/${m.listing.id}`} className="truncate font-bold hover:underline">
                {m.listing.crop} · {m.listing.quantity} {unitLabel(m.listing.unit)} · {formatINR(m.listing.expectedPrice)}
              </Link>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.listing.owner.name} · {m.listing.location.district}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.reasons.join(" · ")}</p>
          </div>
          <MessageButton userId={m.listing.owner.id} name={m.listing.owner.name} variant="outline" context={{ kind: "REQUIREMENT", id: r.id, title: `${r.crop} — ${r.quantity} ${r.unit.toLowerCase()}` }} defaultText={`Namaste ${m.listing.owner.name.split(" ")[0]}, I am interested in your ${m.listing.crop}.`} />
        </li>
      ))}
    </ul>
  );
}

function OwnRequirement({ r }: { r: RequirementDTO }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const setStatus = useSend<{ status: RequirementDTO["status"] }, RequirementDTO>("PATCH", `/requirements/${r.id}`, {
    invalidate: ["/requirements"],
    onSuccess: () => toast({ title: "Requirement updated" }),
    onError: (e) => toast({ kind: "error", title: "Couldn't update", description: e.message }),
  });
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg">Need {r.quantity} {unitLabel(r.unit)} {r.crop}</h3>
            <Badge tone={r.status === "OPEN" ? "success" : "neutral"}>{r.status}</Badge>
            {r.isDemo && <DemoBadge />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {r.district}, {r.state} · {formatShortDate(r.windowStart)} – {formatShortDate(r.windowEnd)}
          </p>
        </div>
        <div className="flex gap-2">
          {r.status === "OPEN" && (
            <>
              <Button size="sm" variant="outline" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: "FULFILLED" })}>
                <CheckCircle2 className="h-4 w-4" /> Fulfilled
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ status: "CLOSED" })}>Close</Button>
            </>
          )}
          <Button size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            Matching produce <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      {open && <div className="border-t bg-muted/30"><MatchesPanel r={r} /></div>}
    </Card>
  );
}

function RequirementsTab() {
  const me = useMe().data;
  const isBuyer = me?.role === "BUYER";
  const canRespond = me?.role === "FARMER" || me?.role === "FPO";
  const [mine, setMine] = useState(isBuyer);
  const [crop, setCrop] = useState("");
  const [district, setDistrict] = useState("");
  const list = useInfiniteList<RequirementDTO>("/requirements", { mine: mine ? "1" : "", crop, district });
  const items = flatten(list.data);
  return (
    <div className="space-y-4">
      {canRespond && <Notice tone="info">Requirements are sorted by how well they match your produce. Respond directly — no payments happen on KaamSetu.</Notice>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Select aria-label="Crop" value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="">Any crop</option>
          {CROPS.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">Any district</option>
          {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
        </Select>
        {isBuyer && <ToggleChip on={mine} onChange={setMine}>My requirements</ToggleChip>}
      </div>
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card><ErrorState error={list.error} onRetry={() => void list.refetch()} /></Card>
      ) : !items.length ? (
        <Card>
          <EmptyState icon={<Handshake className="h-7 w-7" />} title="No requirements" description={isBuyer ? "Post what you need and matching farmers will be notified." : "No open buyer requirements match these filters."} action={isBuyer ? { label: "Post a requirement", href: "/create?type=requirement" } : undefined} />
        </Card>
      ) : (
        <div className={mine && isBuyer ? "space-y-4" : "grid gap-4 md:grid-cols-2"}>
          {items.map((r) => (mine && isBuyer && r.isOwn ? <OwnRequirement key={r.id} r={r} /> : <RequirementCard key={r.id} r={r} canRespond={!!canRespond} />))}
        </div>
      )}
      <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={() => void list.fetchNextPage()} />
    </div>
  );
}

// ───────── Enquiries tab ─────────
function EnquiriesTab() {
  const q = useGet<EnquiryDTO[]>("/enquiries", { staleTime: 0 });
  const toast = useToast();
  const set = useSend<{ id: string; status: EnquiryDTO["status"] }, EnquiryDTO>("PATCH", (v) => `/enquiries/${v.id}`, {
    invalidate: ["/enquiries"],
    onError: (e) => toast({ kind: "error", title: "Couldn't update", description: e.message }),
  });
  if (q.isLoading) return <ListSkeleton count={3} />;
  if (q.isError) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>;
  if (!q.data?.length) return <Card><EmptyState icon={<Package className="h-7 w-7" />} title="No enquiries yet" description="Enquiries you send or receive about produce and requirements show up here." action={{ label: "Browse produce", href: "/market" }} /></Card>;
  return (
    <ul className="space-y-3">
      {q.data.map((e) => (
        <li key={e.id}>
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <UserLine user={e.counterpart} sub={e.direction === "RECEIVED" ? "Enquired about your produce" : "You enquired"} time={e.createdAt} />
              <Badge tone={e.status === "NEW" ? "warning" : e.status === "REPLIED" ? "success" : "neutral"}>{e.status}</Badge>
            </div>
            <p className="mt-2 text-sm font-semibold">
              {e.listing ? `${e.listing.crop} · ${e.listing.quantity} ${unitLabel(e.listing.unit)}` : e.requirement ? `Requirement: ${e.requirement.crop}` : "Enquiry"}
            </p>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{e.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink size="sm" href={`/messages?c=${e.conversationId}`}>Open conversation</ButtonLink>
              {e.status !== "CLOSED" && <Button size="sm" variant="outline" onClick={() => set.mutate({ id: e.id, status: "CLOSED" })}>Mark closed</Button>}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function MarketView() {
  const me = useMe().data;
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.includes((sp.get("tab") ?? "") as Tab) ? sp.get("tab") : "produce") as Tab;
  const setTab = (t: Tab) => router.replace(t === "produce" ? "/market" : `/market?tab=${t}`, { scroll: false });
  const actions = me && (
    <div className="flex gap-2">
      {roleCan(me.role, "listing:create") && <ButtonLink href="/create?type=produce"><Plus className="h-4 w-4" /> List produce</ButtonLink>}
      {roleCan(me.role, "requirement:create") && <ButtonLink href="/create?type=requirement"><Plus className="h-4 w-4" /> Post requirement</ButtonLink>}
      {roleCan(me.role, "service:manage") && <ButtonLink href="/create?type=service" variant="outline"><Plus className="h-4 w-4" /> Add service</ButtonLink>}
    </div>
  );
  return (
    <div>
      <PageHeader title="Market" subtitle="Produce, services, equipment and work — connect directly. KaamSetu does not handle payments or set prices." actions={actions} />
      <Tabs label="Market sections" value={tab} onChange={setTab} className="mb-5" items={[{ id: "produce", label: "Produce" }, { id: "services", label: "Services" }, { id: "equipment", label: "Equipment" }, { id: "opportunities", label: "Opportunities" }, { id: "requirements", label: "Buyer requirements" }, { id: "enquiries", label: "Enquiries" }]} />
      {tab === "produce" && <ProduceTab />}
      {tab === "services" && <ServicesList />}
      {tab === "equipment" && <MachineryView embedded />}
      {tab === "opportunities" && <WorkList />}
      {tab === "requirements" && <RequirementsTab />}
      {tab === "enquiries" && <EnquiriesTab />}
    </div>
  );
}

// ───────── Listing detail ─────────
const enquiryForm = z.object({ message: z.string().trim().min(5, "Write at least a few words").max(800) });

function EnquiryBox({ l }: { l: ListingDetailDTO }) {
  const toast = useToast();
  const router = useRouter();
  const [sent, setSent] = useState(l.enquirySent);
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof enquiryForm>>({
    resolver: zodResolver(enquiryForm),
    defaultValues: { message: `Namaste, I am interested in your ${l.crop} (${l.quantity} ${unitLabel(l.unit)}). Is it still available? Please share the pickup location and your best price.` },
  });
  const submit = handleSubmit(async (v) => {
    try {
      await api("POST", `/listings/${l.id}/enquiries`, v);
      setSent(true);
      toast({ title: "Enquiry sent", description: "The farmer will reply in Messages." });
    } catch (e) {
      setError("message", { message: e instanceof ApiClientError ? e.message : "Couldn't send enquiry" });
    }
  });
  if (sent)
    return (
      <Notice tone="success" title="Enquiry sent">
        <Link href="/market?tab=enquiries" className="font-semibold underline">View your enquiries</Link> or <button onClick={() => router.push("/messages")} className="font-semibold underline">open Messages</button>.
      </Notice>
    );
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field label="Send an enquiry" error={formState.errors.message?.message} required>
        {(a) => <Textarea {...a} rows={4} {...register("message")} />}
      </Field>
      <Button type="submit" loading={formState.isSubmitting} className="w-full">Send enquiry</Button>
      <p className="text-xs text-muted-foreground">Agree price and pickup directly. Never pay in advance to someone you haven&apos;t met, and never share OTP or bank PIN.</p>
    </form>
  );
}

export function ListingDetail({ id }: { id: string }) {
  const me = useMe().data;
  const toast = useToast();
  const q = useGet<ListingDetailDTO>(`/listings/${id}`);
  const setStatus = useSend<{ status: ListingCardDTO["status"] }, ListingCardDTO>("PATCH", `/listings/${id}`, {
    invalidate: ["/listings"],
    onSuccess: () => toast({ title: "Listing updated" }),
    onError: (e) => toast({ kind: "error", title: "Couldn't update", description: e.message }),
  });
  if (q.isLoading) return <ListSkeleton count={2} media />;
  if (q.isError || !q.data) return <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} title="Listing not found" /></Card>;
  const l = q.data;
  const canEnquire = !!me && roleCan(me.role, "enquiry:send") && !l.isOwn;
  return (
    <div className="space-y-6">
      <Link href="/market" className="text-sm font-semibold text-primary hover:underline">← Back to market</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="aspect-[16/8]"><Scene kind={sceneForCrop(l.crop)} /></div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                {l.organic && <Badge tone="success">Organic</Badge>}
                {l.fpo && <Badge tone="info">FPO lot · {l.fpo.name}</Badge>}
                <Badge tone={l.status === "AVAILABLE" ? "success" : "warning"}>{l.status}</Badge>
                {l.isDemo && <DemoBadge />}
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl">{l.crop}{l.variety ? ` · ${l.variety}` : ""}</h1>
                  <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden /> {[l.location.village, l.location.district, l.location.state].filter(Boolean).join(", ")}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold tabular-nums text-primary">{formatINR(l.expectedPrice)}</p>
                  <p className="text-sm text-muted-foreground">expected, per {unitLabel(l.unit).toLowerCase()} · negotiable</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Quantity" value={`${l.quantity} ${unitLabel(l.unit)}`} />
                <Stat label="Grade" value={l.grade} />
                <Stat label="Harvest" value={formatShortDate(l.harvestDate)} />
                <Stat label="Method" value={l.method} />
              </div>
              {l.description && <p className="whitespace-pre-line">{l.description}</p>}
              <p className="text-xs text-muted-foreground">Listed {timeAgo(l.createdAt)}. Price shown is the farmer&apos;s expectation, not a market rate.</p>
              <div className="flex items-center gap-2 border-t pt-4">
                <SaveButton targetType="LISTING" targetId={l.id} saved={l.saved} label />
                <ShareButton title={`${l.crop} for sale`} path={`/market/${l.id}`} />
                {!l.isOwn && <ReportButton targetType="LISTING" targetId={l.id} />}
              </div>
            </div>
          </Card>
          {l.similar.length > 0 && (
            <section>
              <SectionHeader title={`More ${l.crop} listings`} />
              <div className="grid gap-4 sm:grid-cols-2">{l.similar.map((s) => <ListingCard key={s.id} l={s} />)}</div>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-base">Seller</h2>
            {l.ownerCard ? <FarmerCard f={l.ownerCard} /> : <UserLine user={l.owner} />}
          </Card>
          {canEnquire && l.status === "AVAILABLE" && <Card className="p-4"><EnquiryBox l={l} /></Card>}
          {canEnquire && l.status !== "AVAILABLE" && <Notice tone="warning">This listing is {l.status.toLowerCase()} and no longer accepting enquiries.</Notice>}
          {!me || (!canEnquire && !l.isOwn) ? <Notice tone="info">Only buyers and FPOs can send enquiries on produce listings.</Notice> : null}
          {l.isOwn && (
            <Card className="space-y-3 p-4">
              <h2 className="text-base">Manage listing</h2>
              <Field label="Status">
                {(a) => (
                  <Select {...a} value={l.status} disabled={setStatus.isPending} onChange={(e) => setStatus.mutate({ status: e.target.value as ListingCardDTO["status"] })}>
                    <option value="AVAILABLE">Available</option>
                    <option value="RESERVED">Reserved</option>
                    <option value="SOLD">Sold</option>
                    <option value="CLOSED">Closed</option>
                  </Select>
                )}
              </Field>
              <ButtonLink href="/market?tab=enquiries" variant="outline" className="w-full">View enquiries</ButtonLink>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

// ───────── Machinery ─────────
export function MachineryView({ embedded = false }: { embedded?: boolean } = {}) {
  const me = useMe().data;
  const toast = useToast();
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [onlyAvail, setOnlyAvail] = useState(false);
  const [mine, setMine] = useState(false);
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (district) params.set("district", district);
  if (onlyAvail) params.set("available", "1");
  if (mine) params.set("mine", "1");
  const q = useGet<MachineryDTO[]>(`/machinery${params.size ? `?${params}` : ""}`, { keepPrevious: true });
  const toggle = useSend<{ id: string; available: boolean }, MachineryDTO>("PATCH", (v) => `/machinery/${v.id}`, {
    invalidate: ["/machinery"],
    onError: (e) => toast({ kind: "error", title: "Couldn't update", description: e.message }),
  });
  const canList = !!me && roleCan(me.role, "machinery:list");
  return (
    <div>
      {embedded ? (
        canList && <div className="mb-3 flex justify-end"><ButtonLink href="/create?type=machinery" variant="outline" size="sm"><Plus className="h-4 w-4" /> List equipment</ButtonLink></div>
      ) : (
        <PageHeader title="Machinery" subtitle="Find equipment to rent nearby, or list your own. Rates are set by owners — agree terms directly." actions={canList ? <ButtonLink href="/create?type=machinery"><Plus className="h-4 w-4" /> List equipment</ButtonLink> : undefined} />
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Select aria-label="Equipment type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Any type</option>
          {MACHINERY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
          <option value="">Any district</option>
          {DISTRICT_NAMES.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <ToggleChip on={onlyAvail} onChange={setOnlyAvail}>Available now</ToggleChip>
        {canList && <ToggleChip on={mine} onChange={setMine}>My equipment</ToggleChip>}
      </div>
      {q.isLoading ? (
        <ListSkeleton count={3} media />
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>
      ) : !q.data?.length ? (
        <Card><EmptyState title="No equipment found" description="Try another type or district." action={canList ? { label: "List equipment", href: "/create?type=machinery" } : undefined} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((m) => (
            <MachineryCard key={m.id} m={m}>
              {m.isOwn ? (
                <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: m.id, available: !m.available })}>{m.available ? "Mark busy" : "Mark available"}</Button>
              ) : (
                <MessageButton userId={m.owner.id} name={m.owner.name} defaultText={`Namaste, is your ${m.name} available? I need it in ${m.district}.`} context={{ kind: "DIRECT", title: m.name }} label="Enquire" />
              )}
            </MachineryCard>
          ))}
        </div>
      )}
    </div>
  );
}
