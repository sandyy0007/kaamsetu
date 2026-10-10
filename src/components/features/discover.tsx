"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/form";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { LoadMore } from "@/components/ui/load-more";
import { flatten, useInfiniteList } from "@/hooks/use-api";
import { CROPS } from "@/lib/constants";
import { DISTRICT_NAMES } from "@/lib/geo";
import type { BuyerCardDTO, FarmerCardDTO } from "@/types/dto";
import { FilterPanel, SearchField, ToggleChip, useDebounced } from "./filters";
import { BuyerCard, FarmerCard } from "./people";

export function FarmersDiscover() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [crop, setCrop] = useState(sp.get("crop") ?? "");
  const [district, setDistrict] = useState(sp.get("district") ?? "");
  const [minQty, setMinQty] = useState("");
  const [verified, setVerified] = useState(false);
  const [fpo, setFpo] = useState(false);
  const [organic, setOrganic] = useState(false);
  const dq = useDebounced(q);
  const dMin = useDebounced(minQty);
  const list = useInfiniteList<FarmerCardDTO>("/farmers", { q: dq, crop, district, minQty: dMin, verified: verified ? "1" : "", fpo: fpo ? "1" : "", organic: organic ? "1" : "" });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  const active = [crop, district, minQty, verified, fpo, organic].filter(Boolean).length;
  const clear = () => {
    setCrop("");
    setDistrict("");
    setMinQty("");
    setVerified(false);
    setFpo(false);
    setOrganic(false);
  };
  return (
    <div>
      <PageHeader title="Find farmers" subtitle="Search by crop, place or produce. Try natural language like “Mustard farmers near Churu”." />
      <div className="space-y-3">
        <SearchField value={q} onChange={setQ} label="Search farmers" placeholder="Mustard farmers near Churu…" />
        <FilterPanel activeCount={active} onClear={clear}>
          <Select aria-label="Crop" value={crop} onChange={(e) => setCrop(e.target.value)}>
            <option value="">Any crop</option>
            {CROPS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">Any district</option>
            {DISTRICT_NAMES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Input type="number" min={0} inputMode="numeric" aria-label="Minimum quantity in quintal" placeholder="Min. quintal for sale" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <ToggleChip on={verified} onChange={setVerified}>
              Verified
            </ToggleChip>
            <ToggleChip on={fpo} onChange={setFpo}>
              FPO members
            </ToggleChip>
            <ToggleChip on={organic} onChange={setOrganic}>
              Organic
            </ToggleChip>
          </div>
        </FilterPanel>
      </div>
      <p className="mb-3 mt-5 text-sm text-muted-foreground" aria-live="polite">
        {list.isLoading ? "Searching…" : `${list.data?.pages[0]?.total ?? 0} farmers found`}
      </p>
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState title="No farmers match your search" description="Try a different crop or district, or remove some filters." action={active || q ? { label: "Clear search", onClick: () => { clear(); setQ(""); } } : undefined} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((f) => (
              <FarmerCard key={f.user.id} f={f} />
            ))}
          </div>
          <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
        </>
      )}
    </div>
  );
}

export function BuyersDiscover() {
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [crop, setCrop] = useState(sp.get("crop") ?? "");
  const dq = useDebounced(q);
  const list = useInfiniteList<BuyerCardDTO>("/buyers", { q: dq, crop });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  return (
    <div>
      <PageHeader title="Buyers" subtitle="Traders, mills, processors and exporters looking to buy directly from farmers." />
      <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
        <SearchField value={q} onChange={setQ} label="Search buyers" placeholder="Search by business, industry or place" />
        <Select aria-label="Crop bought" value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="">Any crop</option>
          {CROPS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div className="mt-5">
        {list.isLoading ? (
          <ListSkeleton count={3} />
        ) : list.isError ? (
          <Card>
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState title="No buyers found" description="Try another crop or clear the search." />
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((b) => (
                <BuyerCard key={b.user.id} b={b} />
              ))}
            </div>
            <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
          </>
        )}
      </div>
    </div>
  );
}
