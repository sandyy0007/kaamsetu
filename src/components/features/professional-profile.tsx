"use client";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Calendar,
  Globe2,
  Lock,
  MapPin,
  MessageSquareQuote,
  Pencil,
  Plus,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Scene } from "@/components/art/scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/section";
import { Sheet } from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, QueryBoundary } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { useGet } from "@/hooks/use-api";
import { VISIBILITY_LABEL } from "@/lib/constants";
import { sceneForProfession } from "@/lib/profession-scene";
import { formatDate } from "@/lib/utils";
import type {
  PortfolioEntryDTO,
  ProfessionalProfileDTO,
  ServiceDTO,
  WorkHistoryDTO,
} from "@/types/dto";
import { FeedList } from "./feed";
import {
  FarmerFarmsPanel,
  FarmerProducePanel,
  Network,
} from "./farmer-profile";
import {
  PersonActions,
  ProfileHeader,
  Section,
  TagList,
} from "./profile-parts";
import {
  PortfolioForm,
  RecommendationForm,
  ServiceForm,
  WorkHistoryForm,
} from "./pro-forms";
import {
  AvailabilityBadge,
  PAY_UNIT_LABEL,
  ReputationFacts,
  RequestServiceButton,
  ServiceCard,
  WORK_KIND_LABEL,
  WORK_PREFERENCE_LABEL,
} from "./pro-shared";
import { UserLine } from "./people";

type TabId =
  | "about"
  | "services"
  | "portfolio"
  | "experience"
  | "recommendations"
  | "farms"
  | "produce"
  | "posts"
  | "network";

const LEVEL_LABEL = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  EXPERT: "Expert",
} as const;
const RELATIONSHIP_LABEL: Record<string, string> = {
  CUSTOMER: "Customer",
  COLLEAGUE: "Worked together",
  EMPLOYER: "Hired them",
  NEIGHBOUR: "Neighbour",
  TRAINER: "Trainer",
  OTHER: "Other",
};

type SheetState =
  | { kind: "service"; item?: ServiceDTO }
  | { kind: "portfolio"; item?: PortfolioEntryDTO }
  | { kind: "history"; item?: WorkHistoryDTO }
  | { kind: "recommend" }
  | null;

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Plus className="h-4 w-4" /> {label}
    </Button>
  );
}

/** Profession-specific fields come from the catalog definition (`profession.attributes`) — no per-profession code. */
function AttributeList({ p }: { p: ProfessionalProfileDTO }) {
  const rows = p.profession.attributes
    .map((a) => ({ a, v: p.attributes[a.key] }))
    .filter(
      ({ v }) =>
        v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
    );
  if (!rows.length) return null;
  return (
    <Section title={`${p.profession.name} details`}>
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        {rows.map(({ a, v }) => (
          <Detail key={a.key} label={a.label}>
            {Array.isArray(v) ? (
              <TagList items={v} tone="neutral" />
            ) : (
              <span className="font-semibold">{String(v)}</span>
            )}
          </Detail>
        ))}
      </dl>
    </Section>
  );
}

function SkillsSection({ p }: { p: ProfessionalProfileDTO }) {
  return (
    <Section title="Skills">
      {p.skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {p.skills.map((s) => (
            <li
              key={s.name}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm"
            >
              <span className="font-semibold">{s.name}</span>
              <span className="text-xs text-muted-foreground">
                {LEVEL_LABEL[s.level]}
                {s.years ? ` · ${s.years} yr` : ""}
              </span>
              {s.verified && (
                <BadgeCheck
                  className="h-4 w-4 text-success"
                  aria-label="Verified by KaamSetu"
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {p.skills.some((s) => s.verified) && (
        <p className="mt-2 text-xs text-muted-foreground">
          A tick means a KaamSetu admin has checked this skill. You can&apos;t
          verify your own skills.
        </p>
      )}
    </Section>
  );
}

function AboutTab({ p }: { p: ProfessionalProfileDTO }) {
  const self = p.viewer.isSelf;
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Section
          title="About"
          action={
            self ? (
              <Link
                href="/profile/edit"
                className="text-sm font-semibold text-primary hover:underline"
              >
                Edit
              </Link>
            ) : undefined
          }
        >
          {p.about ? (
            <p className="whitespace-pre-line leading-relaxed">{p.about}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {self
                ? "Tell people about your work in a few lines."
                : "No introduction yet."}
            </p>
          )}
        </Section>
        <SkillsSection p={p} />
        <AttributeList p={p} />
        <Section title="Certifications">
          {p.certifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">None added.</p>
          ) : (
            <ul className="space-y-2">
              {p.certifications.map((c) => (
                <li key={c.id} className="flex items-start gap-3">
                  <Award
                    className="mt-0.5 h-5 w-5 shrink-0 text-accent"
                    aria-hidden
                  />
                  <span>
                    <span className="font-semibold">{c.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {c.issuer} · {c.year}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Achievements">
          {p.achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">None added.</p>
          ) : (
            <ul className="space-y-3">
              {p.achievements.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <Trophy
                    className="mt-0.5 h-5 w-5 shrink-0 text-highlight"
                    aria-hidden
                  />
                  <span>
                    <span className="font-semibold">
                      {a.title}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {a.year}
                      </span>
                    </span>
                    {a.description && (
                      <span className="block text-sm text-muted-foreground">
                        {a.description}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
      <div className="space-y-4">
        <Section title="Availability">
          {p.availability ? (
            <div className="space-y-3 text-sm">
              <AvailabilityBadge
                status={p.availability.status}
                label={p.availability.label}
              />
              <dl className="space-y-3">
                {p.availability.days.length > 0 && (
                  <Detail label="Days">
                    <span className="inline-flex items-center gap-1">
                      <Calendar
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden
                      />{" "}
                      {p.availability.days.join(", ")}
                    </span>
                  </Detail>
                )}
                {p.availability.preferences.length > 0 && (
                  <Detail label="Looking for">
                    <TagList
                      items={p.availability.preferences.map(
                        (x) => WORK_PREFERENCE_LABEL[x] ?? x,
                      )}
                      tone="info"
                    />
                  </Detail>
                )}
                {p.availability.expectedWage && (
                  <Detail label="Expected pay">
                    <span className="font-semibold">
                      ₹
                      {p.availability.expectedWage.amount.toLocaleString(
                        "en-IN",
                      )}
                    </span>{" "}
                    {PAY_UNIT_LABEL[
                      p.availability.expectedWage.unit
                    ]?.toLowerCase()}
                  </Detail>
                )}
              </dl>
              {p.availability.note && (
                <p className="text-muted-foreground">{p.availability.note}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not shared.</p>
          )}
        </Section>
        <Section title="Details">
          <dl className="space-y-3 text-sm">
            <Detail label="Profession">
              {p.profession.emoji} {p.customProfession ?? p.profession.name}
              {p.secondaryProfessions.length > 0 && (
                <span className="block text-muted-foreground">
                  Also: {p.secondaryProfessions.map((s) => s.name).join(", ")}
                </span>
              )}
            </Detail>
            <Detail label="Working since">{p.startedYear}</Detail>
            <Detail label="Based in">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />{" "}
                {p.district}, {p.state}
              </span>
            </Detail>
            {p.serviceAreas.length > 0 && (
              <Detail label="Works in">
                <TagList items={p.serviceAreas} tone="neutral" />
              </Detail>
            )}
            {p.serviceRadiusKm ? (
              <Detail label="Travels up to">{p.serviceRadiusKm} km</Detail>
            ) : null}
            <Detail label="Languages">
              <span className="inline-flex items-center gap-1">
                <Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden />{" "}
                {p.languages.join(", ") || "—"}
              </span>
            </Detail>
            {p.phone && <Detail label="Phone">{p.phone}</Detail>}
            {p.business && (
              <Detail label="Business">
                <Link
                  href={`/businesses/${p.business.id}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {p.business.name}
                </Link>
              </Detail>
            )}
          </dl>
        </Section>
        <Section title="Track record">
          <ReputationFacts r={p.reputation} />
          {p.reputation.completedJobs +
            p.reputation.recommendations +
            p.reputation.verifiedSkills +
            p.reputation.certifications ===
            0 && (
            <p className="text-sm text-muted-foreground">
              Builds up as this professional completes jobs, earns
              recommendations and gets skills verified. There are no star
              ratings on KaamSetu.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

function ServicesTab({
  p,
  onEdit,
  onAdd,
}: {
  p: ProfessionalProfileDTO;
  onEdit: (s: ServiceDTO) => void;
  onAdd: () => void;
}) {
  const self = p.viewer.isSelf;
  const list = self ? p.services : p.services.filter((s) => s.active);
  return (
    <div className="space-y-3">
      {self && (
        <div className="flex justify-end">
          <AddButton label="Add a service" onClick={onAdd} />
        </div>
      )}
      {list.length === 0 ? (
        <Card>
          <EmptyState
            title="No services listed"
            description={
              self
                ? "List what you do and what you charge, so people can request your work."
                : "This professional hasn't listed services yet. You can still send a message."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((s) => (
            <ServiceCard key={s.id} s={s} onEdit={self ? onEdit : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function PortfolioTab({
  p,
  onEdit,
  onAdd,
}: {
  p: ProfessionalProfileDTO;
  onEdit: (e: PortfolioEntryDTO) => void;
  onAdd: () => void;
}) {
  const self = p.viewer.isSelf;
  return (
    <div className="space-y-3">
      {self && (
        <div className="flex justify-end">
          <AddButton label="Add work" onClick={onAdd} />
        </div>
      )}
      {p.portfolio.length === 0 ? (
        <Card>
          <EmptyState
            title="No portfolio yet"
            description={
              self
                ? "Show photos and details of work you have done. It is the best way to earn trust."
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {p.portfolio.map((i) => (
            <Card key={i.id} className="overflow-hidden">
              <div className="h-32">
                {i.imageUrl ? (
                  <img
                    src={i.imageUrl}
                    alt={i.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Scene
                    kind={
                      i.media[0]?.scene ??
                      sceneForProfession(
                        p.profession.id,
                        p.profession.dashboard,
                      )
                    }
                  />
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-bold text-primary">
                  {i.category}
                  {i.date && ` · ${formatDate(i.date)}`}
                </p>
                <h3 className="text-base">{i.title}</h3>
                <p className="mt-1 text-sm">{i.description}</p>
                {i.meta && Object.keys(i.meta).length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {Object.values(i.meta).join(" · ")}
                  </p>
                )}
                {i.skillsUsed.length > 0 && (
                  <div className="mt-2">
                    <TagList items={i.skillsUsed} tone="neutral" />
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  {i.source === "FARM" ? (
                    <Badge tone="success">From farm records</Badge>
                  ) : (
                    <span />
                  )}
                  {self && i.source === "PORTFOLIO" && (
                    <Button size="sm" variant="ghost" onClick={() => onEdit(i)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ExperienceTab({
  p,
  onEdit,
  onAdd,
}: {
  p: ProfessionalProfileDTO;
  onEdit: (w: WorkHistoryDTO) => void;
  onAdd: () => void;
}) {
  const self = p.viewer.isSelf;
  return (
    <Section
      title="Work history"
      action={
        self ? <AddButton label="Add experience" onClick={onAdd} /> : undefined
      }
    >
      {p.workHistory.length === 0 ? (
        <EmptyState
          compact
          title="No work history yet"
          description={
            self
              ? "Add the places and kinds of work you have done — self-employed work counts too."
              : undefined
          }
          icon={<Briefcase className="h-6 w-6" />}
        />
      ) : (
        <ol className="relative ml-2 space-y-5 border-l-2 border-primary/25 pl-5">
          {p.workHistory.map((w) => (
            <li key={w.id} className="relative">
              <span
                className="absolute -left-[1.78rem] top-1.5 h-3 w-3 rounded-full border-2 border-card bg-primary"
                aria-hidden
              />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{w.role}</p>
                  <p className="text-sm">
                    {w.organization} ·{" "}
                    <span className="text-muted-foreground">
                      {WORK_KIND_LABEL[w.kind] ?? w.kind}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(w.startDate, {
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    –{" "}
                    {w.endDate
                      ? formatDate(w.endDate, {
                          month: "short",
                          year: "numeric",
                        })
                      : "Present"}
                    {w.location && ` · ${w.location}`}
                  </p>
                </div>
                {self && !w.id.startsWith("wh_mig_") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(w)}
                    aria-label={`Edit ${w.role}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {w.description && <p className="mt-1 text-sm">{w.description}</p>}
              {w.skills.length > 0 && (
                <div className="mt-1.5">
                  <TagList items={w.skills} tone="neutral" />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function RecommendationsTab({
  p,
  onWrite,
}: {
  p: ProfessionalProfileDTO;
  onWrite: () => void;
}) {
  const v = p.viewer;
  return (
    <Section
      title="Recommendations"
      action={
        !v.isSelf && v.canRecommend && !v.hasRecommended ? (
          <AddButton label="Write one" onClick={onWrite} />
        ) : undefined
      }
    >
      {p.recommendations.length === 0 ? (
        <EmptyState
          compact
          title="No recommendations yet"
          description={
            v.isSelf
              ? "Ask customers or colleagues you have worked with to recommend you."
              : "Worked with them? Write what you know."
          }
          icon={<MessageSquareQuote className="h-6 w-6" />}
        />
      ) : (
        <ul className="space-y-3">
          {p.recommendations.map((r) => (
            <li key={r.id} className="rounded-xl border p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <UserLine user={r.author} size="sm" />
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="outline">
                    {RELATIONSHIP_LABEL[r.relationship] ?? r.relationship}
                  </Badge>
                  {r.interactionVerified && (
                    <Badge tone="success">
                      <BadgeCheck className="h-3.5 w-3.5" /> Worked together on
                      KaamSetu
                    </Badge>
                  )}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{r.body}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {r.skill && <>For: {r.skill} · </>}
                {formatDate(r.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!v.isSelf && !v.canRecommend && (
        <p className="mt-3 text-xs text-muted-foreground">
          Sign in to write a recommendation.
        </p>
      )}
    </Section>
  );
}

export function ProfessionalProfileBody({ p }: { p: ProfessionalProfileDTO }) {
  const [tab, setTab] = useState<TabId>("about");
  const [sheet, setSheet] = useState<SheetState>(null);
  const self = p.viewer.isSelf;
  const scene =
    p.farmer?.farms[0]?.scene ??
    sceneForProfession(p.profession.id, p.profession.dashboard);
  const professionName = p.customProfession ?? p.profession.name;

  if (p.restricted) {
    return (
      <div className="space-y-4">
        <ProfileHeader
          user={p.user}
          scene={scene}
          subtitle={`${p.profession.emoji} ${professionName}`}
          location={p.district}
          isSelf={false}
          roleLabel={professionName}
          actions={
            <PersonActions
              user={p.user}
              following={p.viewer.isFollowing}
              connection={p.viewer.connection}
            />
          }
        />
        <Card className="p-8 text-center">
          <Lock
            className="mx-auto mb-3 h-9 w-9 text-muted-foreground"
            aria-hidden
          />
          <p className="font-bold">This profile is private</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Connect with {p.user.name.split(" ")[0]} to see more about their
            work.
          </p>
        </Card>
      </div>
    );
  }

  const items: { id: TabId; label: string; count?: number }[] = [
    { id: "about", label: "About" },
    {
      id: "services",
      label: "Services",
      count: p.services.length || undefined,
    },
    {
      id: "portfolio",
      label: "Portfolio",
      count: p.portfolio.length || undefined,
    },
    { id: "experience", label: "Experience" },
    {
      id: "recommendations",
      label: "Recommendations",
      count: p.recommendations.length || undefined,
    },
    ...(p.farmer
      ? [
          {
            id: "farms" as const,
            label: "Farms & crops",
            count: p.farmer.crops.length || undefined,
          },
          {
            id: "produce" as const,
            label: "Produce",
            count: p.farmer.produce.length || undefined,
          },
        ]
      : []),
    { id: "posts", label: "Posts" },
    { id: "network", label: "Network" },
  ];

  const close = () => setSheet(null);
  const location = [
    "📍",
    [p.village, p.district, p.state].filter(Boolean).join(", "),
  ].join(" ");

  return (
    <div className="space-y-4">
      <ProfileHeader
        user={p.user}
        scene={scene}
        subtitle={`${p.profession.emoji} ${professionName} · ${p.experienceYears} ${p.experienceYears === 1 ? "year" : "years"} experience`}
        location={location}
        roleLabel={professionName}
        isSelf={self}
        sharePath={`/professionals/${p.user.id}`}
        editHref="/profile/edit"
        stats={[
          { label: "Followers", value: p.network.followers },
          { label: "Following", value: p.network.following },
          { label: "Connections", value: p.network.connections },
          { label: "Experience", value: `${p.experienceYears} yrs` },
        ]}
        extraBadges={
          <>
            {p.availability && (
              <AvailabilityBadge
                status={p.availability.status}
                label={p.availability.label}
              />
            )}
            {p.business && (
              <Link href={`/businesses/${p.business.id}`}>
                <Badge tone="info">{p.business.name}</Badge>
              </Link>
            )}
          </>
        }
        actions={
          <>
            <PersonActions
              user={p.user}
              following={p.viewer.isFollowing}
              connection={p.viewer.connection}
              saved={p.viewer.saved}
              saveType="PROFESSIONAL"
            />
            {p.viewer.canRequestService && p.services.some((s) => s.active) && (
              <RequestServiceButton
                size="md"
                providerName={p.user.name}
                services={p.services
                  .filter((s) => s.active)
                  .map((s) => ({
                    id: s.id,
                    name: s.name,
                    priceLabel: s.priceLabel,
                  }))}
              />
            )}
          </>
        }
      />

      {self && p.privacy && (
        <Card className="flex flex-wrap items-center gap-3 p-3.5">
          <ShieldCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>Your privacy:</strong> profile{" "}
            <em>{VISIBILITY_LABEL[p.privacy.profile]}</em> · phone{" "}
            <em>{VISIBILITY_LABEL[p.privacy.phone]}</em> · exact home address is
            never shown
          </p>
          <Link
            href="/settings#privacy"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Change
          </Link>
        </Card>
      )}

      {self && p.services.length === 0 && (
        <Notice tone="info" title="Let people hire you">
          Add the services you offer. Then anyone nearby can send you a service
          request.{" "}
          <button
            className="font-semibold text-primary underline"
            onClick={() => {
              setTab("services");
              setSheet({ kind: "service" });
            }}
          >
            Add a service
          </button>
        </Notice>
      )}

      <Tabs
        label="Profile sections"
        items={items}
        value={tab}
        onChange={setTab}
      />

      {tab === "about" && <AboutTab p={p} />}
      {tab === "services" && (
        <ServicesTab
          p={p}
          onAdd={() => setSheet({ kind: "service" })}
          onEdit={(item) => setSheet({ kind: "service", item })}
        />
      )}
      {tab === "portfolio" && (
        <PortfolioTab
          p={p}
          onAdd={() => setSheet({ kind: "portfolio" })}
          onEdit={(item) => setSheet({ kind: "portfolio", item })}
        />
      )}
      {tab === "experience" && (
        <ExperienceTab
          p={p}
          onAdd={() => setSheet({ kind: "history" })}
          onEdit={(item) => setSheet({ kind: "history", item })}
        />
      )}
      {tab === "recommendations" && (
        <RecommendationsTab
          p={p}
          onWrite={() => setSheet({ kind: "recommend" })}
        />
      )}
      {tab === "farms" && p.farmer && <FarmerFarmsPanel p={p.farmer} />}
      {tab === "produce" && p.farmer && <FarmerProducePanel p={p.farmer} />}
      {tab === "posts" && (
        <FeedList
          authorId={p.user.id}
          emptyAction={
            self
              ? { label: "Create a post", href: "/create?type=post" }
              : { label: "Back to Home", href: "/home" }
          }
        />
      )}
      {tab === "network" && <Network id={p.user.id} />}

      <Sheet
        open={sheet?.kind === "service"}
        onClose={close}
        title={
          sheet?.kind === "service" && sheet.item
            ? "Edit service"
            : "Add a service"
        }
        description="What you offer and what it costs."
      >
        {sheet?.kind === "service" && (
          <ServiceForm initial={sheet.item} onDone={close} onCancel={close} />
        )}
      </Sheet>
      <Sheet
        open={sheet?.kind === "portfolio"}
        onClose={close}
        title={
          sheet?.kind === "portfolio" && sheet.item
            ? "Edit portfolio entry"
            : "Add to your portfolio"
        }
      >
        {sheet?.kind === "portfolio" && (
          <PortfolioForm initial={sheet.item} onDone={close} onCancel={close} />
        )}
      </Sheet>
      <Sheet
        open={sheet?.kind === "history"}
        onClose={close}
        title={
          sheet?.kind === "history" && sheet.item
            ? "Edit experience"
            : "Add experience"
        }
      >
        {sheet?.kind === "history" && (
          <WorkHistoryForm
            initial={sheet.item}
            onDone={close}
            onCancel={close}
          />
        )}
      </Sheet>
      <Sheet
        open={sheet?.kind === "recommend"}
        onClose={close}
        title={`Recommend ${p.user.name}`}
      >
        {sheet?.kind === "recommend" && (
          <RecommendationForm
            professionalId={p.user.id}
            skills={p.skills.map((s) => s.name)}
            onDone={close}
            onCancel={close}
          />
        )}
      </Sheet>
    </div>
  );
}

export function ProfessionalProfileView({ id }: { id: string }) {
  const q = useGet<ProfessionalProfileDTO>(`/professionals/${id}`);
  return (
    <QueryBoundary query={q} skeleton={<ListSkeleton count={3} />}>
      {(p) => <ProfessionalProfileBody p={p} />}
    </QueryBoundary>
  );
}
