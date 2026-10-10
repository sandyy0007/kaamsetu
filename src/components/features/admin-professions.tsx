"use client";
import { BadgeCheck, Check, GitMerge, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { TagInput } from "@/components/ui/tag-input";
import { useGet, useInvalidate } from "@/hooks/use-api";
import { api, ApiClientError } from "@/lib/api";
import type { AdminUserRow, ProfessionalProfileDTO, UserSummary } from "@/types/dto";
import { SearchField, useDebounced } from "./filters";
import { ProfessionMultiPicker } from "./pro-forms";
import { useCatalog } from "./pro-shared";

interface ProfRow {
  id: string;
  name: string;
  nameHi: string;
  emoji: string;
  categoryId: string;
  categoryName: string;
  status: "ACTIVE" | "PENDING" | "REJECTED";
  custom: boolean;
  farmModules: boolean;
  createdBy?: UserSummary;
  users: number;
}

function errText(e: unknown) {
  return e instanceof ApiClientError ? (Object.values(e.fields ?? {})[0] ?? e.message) : e instanceof Error ? e.message : "Something went wrong";
}

function AddProfession({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: catalog } = useCatalog();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [v, setV] = useState({ name: "", nameHi: "", emoji: "🛠️", categoryId: "" });
  const [skills, setSkills] = useState<string[]>([]);
  const [syn, setSyn] = useState<string[]>([]);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr(undefined);
    try {
      await api("POST", "/admin/professions", { ...v, suggestedSkills: skills, synonyms: syn });
      await invalidate("/admin", "/catalog");
      toast({ title: "Profession added" });
      setV({ name: "", nameHi: "", emoji: "🛠️", categoryId: "" });
      setSkills([]);
      setSyn([]);
      onClose();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Add a profession" description="It appears immediately for everyone in the profession list.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>{(a) => <Input {...a} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={60} />}</Field>
          <Field label="Name in Hindi">{(a) => <Input {...a} value={v.nameHi} onChange={(e) => setV({ ...v, nameHi: e.target.value })} maxLength={60} />}</Field>
          <Field label="Emoji" required>{(a) => <Input {...a} value={v.emoji} onChange={(e) => setV({ ...v, emoji: e.target.value })} maxLength={8} className="max-w-[6rem]" />}</Field>
          <Field label="Category" required>
            {(a) => (
              <Select {...a} value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>
                <option value="">Choose…</option>
                {catalog?.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Other names people use" hint="Helps search. Press Enter after each.">{(a) => <TagInput id={a.id} value={syn} onChange={setSyn} max={12} />}</Field>
        <Field label="Suggested skills">{(a) => <TagInput id={a.id} value={skills} onChange={setSkills} max={30} />}</Field>
        {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Add profession</Button>
        </div>
      </div>
    </Sheet>
  );
}

function ProfessionRow({ p, active }: { p: ProfRow; active: ProfRow[] }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [merge, setMerge] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      await api("PATCH", `/admin/professions/${p.id}`, body);
      await invalidate("/admin", "/catalog", "/professionals");
      toast({ title: ok });
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update", description: errText(e) });
    } finally {
      setBusy(false);
    }
  };
  const locked = p.farmModules || p.id === "pr_other";
  return (
    <li className="flex flex-wrap items-center gap-3 p-3.5">
      <span className="text-2xl" aria-hidden>{p.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-bold">
          {p.name}
          <Badge tone={p.status === "ACTIVE" ? "success" : p.status === "PENDING" ? "warning" : "neutral"}>{p.status.toLowerCase()}</Badge>
          {p.custom && <Badge tone="outline">user-suggested</Badge>}
          {locked && <Badge tone="outline">built in</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">
          {p.categoryName} · {p.users} {p.users === 1 ? "person" : "people"}
          {p.createdBy ? ` · suggested by ${p.createdBy.name}` : ""}
        </p>
      </div>
      {!locked && p.status === "PENDING" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => act({ status: "ACTIVE" }, "Profession approved")}>
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Select aria-label={`Merge ${p.name} into`} value={merge} onChange={(e) => setMerge(e.target.value)} className="w-44">
            <option value="">Merge into…</option>
            {active.filter((x) => x.id !== p.id).map((x) => (
              <option key={x.id} value={x.id}>
                {x.emoji} {x.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="outline" disabled={busy || !merge} onClick={() => act({ status: "ACTIVE", mergeInto: merge }, "Merged")}>
            <GitMerge className="h-4 w-4" /> Merge
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ status: "REJECTED" }, "Rejected — people keep their profile as “Other”")}>
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      )}
      {!locked && p.status === "ACTIVE" && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ status: "REJECTED" }, "Profession removed from the list")}>
          Remove
        </Button>
      )}
      {!locked && p.status === "REJECTED" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act({ status: "ACTIVE" }, "Profession restored")}>
          Restore
        </Button>
      )}
    </li>
  );
}

export function ProfessionsAdmin() {
  const [status, setStatus] = useState<"PENDING" | "ACTIVE" | "REJECTED">("PENDING");
  const [adding, setAdding] = useState(false);
  const q = useGet<ProfRow[]>(`/admin/professions?status=${status}`, { staleTime: 0, keepPrevious: true });
  const actives = useGet<ProfRow[]>("/admin/professions?status=ACTIVE", { staleTime: 0 });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs label="Profession status" value={status} onChange={setStatus} items={[{ id: "PENDING", label: "Waiting for review" }, { id: "ACTIVE", label: "In the list" }, { id: "REJECTED", label: "Rejected" }]} />
        <Button size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add profession
        </Button>
      </div>
      <Notice tone="info">When someone chooses “Other”, their profession waits here. Approving adds it for everyone; merging moves people to an existing profession; rejecting keeps them on “Other” with the words they chose — nobody loses their account.</Notice>
      {q.isLoading ? (
        <ListSkeleton count={3} />
      ) : q.isError ? (
        <Card><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Card>
      ) : !q.data?.length ? (
        <Card><EmptyState icon={<BadgeCheck className="h-7 w-7" />} title="Nothing here" description={status === "PENDING" ? "No professions are waiting for review." : undefined} /></Card>
      ) : (
        <Card><ul className="divide-y">{q.data.map((p) => <ProfessionRow key={p.id} p={p} active={actives.data ?? []} />)}</ul></Card>
      )}
      <AddProfession open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

// ───────────── skills ─────────────
interface SkillRow {
  id: string;
  name: string;
  professions: string[];
}

function VerifySkills() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [picked, setPicked] = useState<UserSummary | null>(null);
  const users = useGet<AdminUserRow[]>(dq.length >= 2 ? `/admin/users?q=${encodeURIComponent(dq)}&role=PROFESSIONAL` : null, { staleTime: 0 });
  const profile = useGet<ProfessionalProfileDTO>(picked ? `/professionals/${picked.id}` : null, { staleTime: 0 });
  const toast = useToast();
  const invalidate = useInvalidate();
  const toggle = async (skill: string, verified: boolean) => {
    if (!picked) return;
    try {
      await api("POST", `/admin/professionals/${picked.id}/verify-skill`, { skill, verified });
      await Promise.all([profile.refetch(), invalidate("/professionals")]);
      toast({ title: verified ? "Skill verified" : "Verification removed" });
    } catch (e) {
      toast({ kind: "error", title: "Couldn't update", description: errText(e) });
    }
  };
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-base">Verify a person&apos;s skill</h2>
      <p className="text-sm text-muted-foreground">Mark a skill as verified only after you have checked it outside KaamSetu (certificate, trade licence, a reference). People cannot verify their own skills.</p>
      <SearchField value={q} onChange={(v) => { setQ(v); setPicked(null); }} label="Find a professional" placeholder="Search a professional by name" voice={false} />
      {!picked && users.data && (
        <ul className="divide-y rounded-xl border">
          {users.data.length === 0 && <li className="p-3 text-sm text-muted-foreground">No professionals match.</li>}
          {users.data.slice(0, 6).map((u) => (
            <li key={u.user.id}>
              <button type="button" onClick={() => setPicked(u.user)} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-semibold hover:bg-muted">
                {u.user.name} <span className="text-xs font-normal text-muted-foreground">{u.user.profession?.name ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && profile.data && (
        <div>
          <p className="mb-2 text-sm font-bold">{picked.name}</p>
          {profile.data.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills added yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {profile.data.skills.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-2 rounded-xl border p-2.5 text-sm">
                  <span className="font-semibold">{s.name}</span>
                  <Button size="sm" variant={s.verified ? "outline" : "primary"} onClick={() => toggle(s.name, !s.verified)}>
                    {s.verified ? "Remove verification" : "Verify"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function SkillsAdmin() {
  const { professions } = useCatalog();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const list = useGet<SkillRow[]>(`/admin/skills${dq ? `?q=${encodeURIComponent(dq)}` : ""}`, { staleTime: 0, keepPrevious: true });
  const toast = useToast();
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [forProf, setForProf] = useState<string[]>([]);
  const [err, setErr] = useState<string>();
  const add = async () => {
    setErr(undefined);
    try {
      await api("POST", "/admin/skills", { name, professionIds: forProf });
      await invalidate("/admin", "/catalog");
      setName("");
      setForProf([]);
      toast({ title: "Skill added" });
    } catch (e) {
      setErr(errText(e));
    }
  };
  const remove = async (id: string) => {
    try {
      await api("DELETE", `/admin/skills/${id}`);
      await invalidate("/admin", "/catalog");
      toast({ title: "Skill removed from suggestions" });
    } catch (e) {
      toast({ kind: "error", title: "Couldn't remove", description: errText(e) });
    }
  };
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="text-base">Add a suggested skill</h2>
        <Field label="Skill name" required error={err}>{(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}</Field>
        <Field label="Suggest it to these professions" hint="Leave empty to suggest it to everyone.">{() => <ProfessionMultiPicker label="Professions" value={forProf} onChange={setForProf} max={20} />}</Field>
        <div className="flex justify-end">
          <Button onClick={add} disabled={name.trim().length < 2}><Plus className="h-4 w-4" /> Add skill</Button>
        </div>
      </Card>
      <VerifySkills />
      <SearchField value={q} onChange={setQ} label="Search skills" placeholder="Search the skill list" voice={false} />
      {list.isLoading ? (
        <ListSkeleton count={3} />
      ) : list.isError ? (
        <Card><ErrorState error={list.error} onRetry={() => void list.refetch()} /></Card>
      ) : !list.data?.length ? (
        <Card><EmptyState title="No skills found" /></Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {list.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.professions.length ? s.professions.join(", ") : professions.length ? "All professions" : ""}</p>
                </div>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
