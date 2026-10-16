"use client";
import { Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader } from "@/components/ui/section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { flatten, useInfiniteList } from "@/hooks/use-api";
import { DISTRICT_NAMES } from "@/lib/geo";
import type { ProfessionalCardDTO } from "@/types/dto";
import { FilterPanel, SearchField, ToggleChip, useDebounced } from "./filters";
import { ProfessionalCard, useCatalog } from "./pro-shared";
import { ProfessionalProfileView } from "./professional-profile";

function ProfessionalsDiscoverContent() {
  const sp = useSearchParams();
  const { data: catalog } = useCatalog();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [profession, setProfession] = useState(sp.get("profession") ?? "");
  const [skill, setSkill] = useState("");
  const [service, setService] = useState("");
  const [district, setDistrict] = useState(sp.get("district") ?? "");
  const [maxKm, setMaxKm] = useState("");
  const [minExp, setMinExp] = useState("");
  const [available, setAvailable] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sort, setSort] = useState("relevance");
  const dq = useDebounced(q);
  const dSkill = useDebounced(skill);
  const dService = useDebounced(service);
  const list = useInfiniteList<ProfessionalCardDTO>("/professionals", {
    q: dq,
    profession,
    skill: dSkill,
    service: dService,
    near: district && maxKm ? district : "",
    district: district && !maxKm ? district : "",
    maxKm,
    minExperience: minExp,
    available: available ? "1" : "",
    verified: verified ? "1" : "",
    sort,
  });
  const more = useCallback(() => void list.fetchNextPage(), [list]);
  const items = flatten(list.data);
  const active = [profession, skill, service, district, maxKm, minExp, available, verified].filter(Boolean).length;
  const clear = () => {
    setProfession("");
    setSkill("");
    setService("");
    setDistrict("");
    setMaxKm("");
    setMinExp("");
    setAvailable(false);
    setVerified(false);
  };
  return (
    <div>
      <PageHeader title="Find professionals" subtitle="Farmers, electricians, carpenters, mechanics, drivers, tailors, artisans and more. Try “electrician near Churu” or say it with the mic." />
      <div className="space-y-3">
        <SearchField value={q} onChange={setQ} label="Search professionals" placeholder="Electrician near Churu…" />
        <FilterPanel activeCount={active} onClear={clear}>
          <Select aria-label="Profession" value={profession} onChange={(e) => setProfession(e.target.value)}>
            <option value="">Any profession</option>
            {catalog?.categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                {c.professions
                  .filter((p) => p.status === "ACTIVE")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
          <Input aria-label="Skill" placeholder="Skill, e.g. Inverter repair" value={skill} onChange={(e) => setSkill(e.target.value)} />
          <Input aria-label="Service" placeholder="Service, e.g. House wiring" value={service} onChange={(e) => setService(e.target.value)} />
          <Select aria-label="District" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">Anywhere</option>
            {DISTRICT_NAMES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select aria-label="Distance from the district" value={maxKm} onChange={(e) => setMaxKm(e.target.value)} disabled={!district}>
            <option value="">Exactly this district</option>
            <option value="25">Within 25 km</option>
            <option value="50">Within 50 km</option>
            <option value="100">Within 100 km</option>
            <option value="200">Within 200 km</option>
          </Select>
          <Input type="number" min={0} max={60} inputMode="numeric" aria-label="Minimum years of experience" placeholder="Min. years of experience" value={minExp} onChange={(e) => setMinExp(e.target.value)} />
          <Select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="relevance">Best match</option>
            <option value="distance" disabled={!district}>Nearest first</option>
            <option value="experience">Most experience</option>
            <option value="verified">Verified first</option>
          </Select>
          <div className="flex flex-wrap gap-2">
            <ToggleChip on={available} onChange={setAvailable}>
              Available now
            </ToggleChip>
            <ToggleChip on={verified} onChange={setVerified}>
              Verified
            </ToggleChip>
          </div>
        </FilterPanel>
      </div>
      <p className="mb-3 mt-5 text-sm text-muted-foreground" aria-live="polite">
        {list.isLoading ? "Searching…" : `${list.data?.pages[0]?.total ?? 0} professionals found`}
      </p>
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-7 w-7" />} title="No professionals match your search" description="Try a different profession or place, or remove some filters." action={active || q ? { label: "Clear search", onClick: () => { clear(); setQ(""); } } : undefined} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <ProfessionalCard key={p.user.id} p={p} />
            ))}
          </div>
          <LoadMore hasMore={!!list.hasNextPage} loading={list.isFetchingNextPage} onLoad={more} />
        </>
      )}
    </div>
  );
}

/** Find Professionals — one discovery page for every profession (farmers included). Supports ?id= query param to display a profile directly. */
export function ProfessionalsDiscover() {
  const sp = useSearchParams();
  const profileId = sp.get("id");
  if (profileId) {
    return <ProfessionalProfileView id={profileId} />;
  }
  return <ProfessionalsDiscoverContent />;
}
