import { z } from "zod";
import type { AgriEvent, Course, CourseModule, GovernmentScheme, LiveSession } from "@/types/domain";
import type { CourseDetailDTO, HealthDTO, LiveMessageDTO, Page, QuestionDTO } from "@/types/dto";
import { answerSchema, courseProgressSchema, eventSchema, liveMessageSchema, liveScheduleSchema, questionSchema, schemeSchema } from "@/lib/schemas";
import { sanitizeText } from "@/lib/utils";
import { newId } from "../../crypto";
import { persist } from "../../db";
import { badRequest, forbidden, notFound } from "../../errors";
import { courseCard, eventDTO, eventStatus, liveDTO, questionDTO, schemeDTO, summaryById, type View } from "../../mappers";
import { requireCap, requireUser } from "../../permissions";
import { isBlockedEitherWay } from "../../privacy";
import { assertSafeText } from "../../services/messaging";
import { notify } from "../../services/notify";
import { courseForViewer, isFarmViewer, schemeForViewer } from "../../services/opportunities";
import { route, type Ctx } from "../router";

const view = (c: Ctx): View => ({ d: c.d, viewer: c.user });

function paginate<T>(items: T[], c: Ctx, limit = 12): Page<T> {
  const start = Number(c.query.get("cursor") ?? 0) || 0;
  const l = Math.min(50, Number(c.query.get("limit") ?? limit) || limit);
  return { items: items.slice(start, start + l), nextCursor: start + l < items.length ? String(start + l) : null, total: items.length };
}

// ───────────── Q&A ─────────────
route("GET", "/questions", (c) => {
  const u = requireUser(c.user);
  const v = view(c);
  const status = c.query.get("status");
  const scope = c.query.get("scope"); // mine | forMe | all
  const crop = c.query.get("crop")?.toLowerCase();
  const category = c.query.get("category");
  const q = (c.query.get("q") ?? "").toLowerCase();
  const rows = c.d.questions
    .filter((x) => {
      if (x.hidden && x.askerId !== u.id && u.role !== "ADMIN") return false;
      if (isBlockedEitherWay(c.d, u.id, x.askerId)) return false;
      if (scope === "mine" && x.askerId !== u.id) return false;
      if (scope === "forMe" && !(u.role === "EXPERT" && (!x.expertId || x.expertId === u.id))) return false;
      if (status && x.status !== status) return false;
      if (crop && x.crop?.toLowerCase() !== crop) return false;
      if (category && x.category !== category) return false;
      if (q && !`${x.body} ${x.crop ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate<QuestionDTO>(rows.map((x) => questionDTO(v, x)), c, 10);
});

route("GET", "/questions/:id", (c) => {
  requireUser(c.user);
  const q = c.d.questions.find((x) => x.id === c.params.id);
  if (!q || (q.hidden && q.askerId !== c.user!.id && c.user!.role !== "ADMIN")) throw notFound("Question");
  return questionDTO(view(c), q);
});

route("POST", "/questions", async (c) => {
  const u = requireCap(c.user, "question:ask");
  const input = await c.body(questionSchema);
  assertSafeText(input.body);
  if (input.imageUrl && !input.imageUrl.startsWith("/api/files/")) throw badRequest("Images must be uploaded through KaamSetu.");
  if (input.expertId && !c.d.expertProfiles.some((e) => e.userId === input.expertId)) throw notFound("Expert");
  const q = { id: newId("q"), askerId: u.id, ...input, status: "OPEN" as const, hidden: false, createdAt: new Date().toISOString(), isDemo: false };
  c.d.questions.push(q);
  const targets = input.expertId
    ? [input.expertId]
    : c.d.expertProfiles.filter((e) => input.crop && e.specialization.some((s) => s.toLowerCase().includes(input.crop!.toLowerCase()))).map((e) => e.userId);
  targets.forEach((id) => notify(c.d, id, "EXPERT", "New farmer question", input.body.slice(0, 90), "/experts?tab=questions"));
  persist();
  return questionDTO(view(c), q);
});

route("POST", "/questions/:id/answers", async (c) => {
  const u = requireCap(c.user, "question:answer");
  const q = c.d.questions.find((x) => x.id === c.params.id && !x.hidden);
  if (!q) throw notFound("Question");
  if (q.expertId && q.expertId !== u.id && u.role !== "ADMIN") throw forbidden("This question was sent to a specific expert.");
  const { body } = await c.body(answerSchema);
  assertSafeText(body);
  c.d.answers.push({ id: newId("a"), questionId: q.id, expertId: u.id, body, helpful: 0, createdAt: new Date().toISOString(), isDemo: false });
  q.status = "ANSWERED";
  notify(c.d, q.askerId, "EXPERT", `${u.name} answered your question`, body.slice(0, 90), `/experts?tab=questions&q=${q.id}`);
  persist();
  return questionDTO(view(c), q);
});

route("POST", "/answers/:id/helpful", (c) => {
  const u = requireUser(c.user);
  const a = c.d.answers.find((x) => x.id === c.params.id);
  if (!a) throw notFound("Answer");
  const idx = c.d.likes.findIndex((l) => l.userId === u.id && l.targetType === "COMMENT" && l.targetId === a.id);
  if (idx >= 0) {
    c.d.likes.splice(idx, 1);
    a.helpful = Math.max(0, a.helpful - 1);
  } else {
    c.d.likes.push({ userId: u.id, targetType: "COMMENT", targetId: a.id, createdAt: new Date().toISOString(), isDemo: false });
    a.helpful += 1;
  }
  persist();
  return { helpful: a.helpful, marked: idx < 0 };
});

// ───────────── Learning hub ─────────────
route("GET", "/courses", (c) => {
  const v = view(c);
  const category = c.query.get("category")?.toLowerCase();
  const q = (c.query.get("q") ?? "").toLowerCase();
  const profession = c.query.get("profession"); // a profession id: that profession's courses (+ general ones tagged "ALL")
  const forMe = c.query.get("for") === "me"; // profession-aware list for the signed-in user
  const myProfession = c.user ? c.d.professionalProfiles.find((p) => p.userId === c.user!.id)?.professionId : undefined;
  const farm = isFarmViewer(c.d, c.user);
  return c.d.courses
    .filter(
      (x) =>
        !x.hidden &&
        (!category || x.category.toLowerCase() === category) &&
        (!profession || x.professionIds?.includes(profession) || x.professionIds?.includes("ALL")) &&
        (!forMe || courseForViewer(x.professionIds, myProfession, farm)) &&
        (!q || `${x.title} ${x.category} ${x.description}`.toLowerCase().includes(q)),
    )
    .map((x) => courseCard(v, x));
});

function courseDetail(c: Ctx, course: Course): CourseDetailDTO {
  const v = view(c);
  const progress = c.user ? c.d.courseProgress.find((p) => p.userId === c.user!.id && p.courseId === course.id) : undefined;
  const cert = progress?.certificateId ? c.d.certificates.find((x) => x.id === progress.certificateId) : undefined;
  const modules = c.d.courseModules
    .filter((m) => m.courseId === course.id)
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      id: m.id,
      order: m.order,
      title: m.title,
      kind: m.kind,
      durationMin: m.durationMin,
      body: m.body,
      quiz: m.quiz?.map((q) => ({ id: q.id, question: q.question, options: q.options })),
      done: !!progress?.completedModuleIds.includes(m.id),
    }));
  return {
    ...courseCard(v, course),
    outcomes: course.outcomes,
    modules,
    certificate: cert && { id: cert.id, code: cert.code, issuedAt: cert.issuedAt, holder: summaryById(c.d, cert.userId).name },
  };
}

route("GET", "/courses/:id", (c) => {
  const course = c.d.courses.find((x) => x.id === c.params.id && !x.hidden);
  if (!course) throw notFound("Course");
  return courseDetail(c, course);
});

function markComplete(c: Ctx, course: Course, moduleId: string, quizScore?: number) {
  const u = requireUser(c.user);
  const mod = c.d.courseModules.find((m) => m.id === moduleId && m.courseId === course.id);
  if (!mod) throw notFound("Lesson");
  let progress = c.d.courseProgress.find((p) => p.userId === u.id && p.courseId === course.id);
  if (!progress) {
    progress = { userId: u.id, courseId: course.id, completedModuleIds: [], quizScores: {}, updatedAt: new Date().toISOString(), isDemo: false };
    c.d.courseProgress.push(progress);
  }
  if (!progress.completedModuleIds.includes(moduleId)) progress.completedModuleIds.push(moduleId);
  if (quizScore !== undefined) progress.quizScores[moduleId] = quizScore;
  progress.updatedAt = new Date().toISOString();
  const all = c.d.courseModules.filter((m) => m.courseId === course.id);
  if (all.every((m) => progress!.completedModuleIds.includes(m.id)) && !progress.certificateId) {
    // Certificate architecture: record + public verification code. Rendering/PDF export plugs in on top.
    const cert = { id: newId("cert"), userId: u.id, courseId: course.id, code: `KS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, issuedAt: new Date().toISOString(), isDemo: false };
    c.d.certificates.push(cert);
    progress.certificateId = cert.id;
    notify(c.d, u.id, "LEARNING", "Certificate ready", `You completed “${course.title}”.`, `/learning/${course.id}`);
  }
  persist();
}

route("POST", "/courses/:id/complete", async (c) => {
  const course = c.d.courses.find((x) => x.id === c.params.id && !x.hidden);
  if (!course) throw notFound("Course");
  const { moduleId } = await c.body(courseProgressSchema);
  const mod = c.d.courseModules.find((m) => m.id === moduleId);
  if (mod?.kind === "QUIZ") throw badRequest("Complete the quiz to finish this lesson.");
  markComplete(c, course, moduleId);
  return courseDetail(c, course);
});

route("POST", "/courses/:id/quiz/:moduleId", async (c) => {
  const course = c.d.courses.find((x) => x.id === c.params.id && !x.hidden);
  const mod = c.d.courseModules.find((m) => m.id === c.params.moduleId && m.courseId === c.params.id);
  if (!course || !mod?.quiz) throw notFound("Quiz");
  const { answers } = await c.body(z.object({ answers: z.array(z.number().int()).length(mod.quiz.length) }));
  const correct = mod.quiz.filter((q, i) => q.answerIndex === answers[i]).length;
  const score = Math.round((correct / mod.quiz.length) * 100);
  const passed = score >= 60; // grading happens server-side; answers never reach the browser
  if (passed) markComplete(c, course, mod.id, score);
  return { score, passed, correct, total: mod.quiz.length, results: mod.quiz.map((q, i) => ({ id: q.id, correct: q.answerIndex === answers[i], correctIndex: q.answerIndex })), course: courseDetail(c, course) };
});

const courseCreateSchema = z.object({
  title: z.string().trim().min(5).max(120),
  category: z.string().trim().min(2).max(40),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  description: z.string().trim().min(10).max(600),
  lessonTitle: z.string().trim().min(3).max(120),
  lessonBody: z.string().trim().min(20).max(4000),
});

route("POST", "/courses", async (c) => {
  const u = requireCap(c.user, "course:create");
  const input = await c.body(courseCreateSchema);
  const course: Course = { id: newId("crs"), title: sanitizeText(input.title), category: sanitizeText(input.category), level: input.level, description: sanitizeText(input.description), outcomes: [], authorId: u.id, scene: "classroom", hidden: false, createdAt: new Date().toISOString(), isDemo: false };
  c.d.courses.push(course);
  const mod: CourseModule = { id: `${course.id}_m1`, courseId: course.id, order: 1, title: sanitizeText(input.lessonTitle), kind: "ARTICLE", durationMin: Math.max(3, Math.round(input.lessonBody.length / 800)), body: sanitizeText(input.lessonBody), isDemo: false };
  c.d.courseModules.push(mod);
  persist();
  return courseDetail(c, course);
});

route("POST", "/courses/:id/modules", async (c) => {
  const u = requireCap(c.user, "course:create");
  const course = c.d.courses.find((x) => x.id === c.params.id && (x.authorId === u.id || u.role === "ADMIN"));
  if (!course) throw notFound("Course");
  const input = await c.body(z.object({ title: z.string().trim().min(3).max(120), body: z.string().trim().min(20).max(4000), kind: z.enum(["ARTICLE", "VIDEO"]).default("ARTICLE") }));
  const order = c.d.courseModules.filter((m) => m.courseId === course.id).length + 1;
  c.d.courseModules.push({ id: `${course.id}_m${order}_${Math.random().toString(36).slice(2, 5)}`, courseId: course.id, order, title: sanitizeText(input.title), kind: input.kind, durationMin: Math.max(3, Math.round(input.body.length / 800)), body: sanitizeText(input.body), isDemo: false });
  persist();
  return courseDetail(c, course);
});

route("GET", "/certificates", (c) => {
  const u = requireUser(c.user);
  return c.d.certificates.filter((x) => x.userId === u.id).map((x) => ({ id: x.id, code: x.code, issuedAt: x.issuedAt, course: c.d.courses.find((k) => k.id === x.courseId)?.title ?? "Course", holder: u.name }));
});

route("GET", "/certificates/verify/:code", (c) => {
  const cert = c.d.certificates.find((x) => x.code === c.params.code);
  if (!cert) throw notFound("Certificate");
  return { valid: true, holder: summaryById(c.d, cert.userId).name, course: c.d.courses.find((k) => k.id === cert.courseId)?.title, issuedAt: cert.issuedAt };
}, { auth: "optional" });

// ───────────── Health & safety ─────────────
route("GET", "/health", (c): HealthDTO[] => {
  const topic = c.query.get("topic");
  const kind = c.query.get("kind");
  return c.d.healthResources
    .filter((h) => !h.hidden && (!topic || h.topic === topic) && (!kind || h.kind === kind))
    .map(({ hidden: _h, isDemo: _d, ...rest }) => rest);
});

// ───────────── Government hub ─────────────
route("GET", "/schemes", (c) => {
  const v = view(c);
  const category = c.query.get("category");
  const group = c.query.get("group"); // schemes|subsidies|notifications|training|alerts
  const q = (c.query.get("q") ?? "").toLowerCase();
  const orgId = c.query.get("org");
  const topic = c.query.get("topic"); // Agriculture | Skill development | Employment | Apprenticeship | Entrepreneurship | Worker welfare | Safety
  const forMe = c.query.get("for") === "me"; // only entries whose audience includes the signed-in user's profession
  const groups: Record<string, GovernmentScheme["category"][]> = {
    schemes: ["SCHEME", "INSURANCE", "CREDIT"],
    subsidies: ["SUBSIDY"],
    notifications: ["NOTIFICATION"],
    training: ["TRAINING"],
    alerts: ["ALERT"],
  };
  return c.d.schemes
    .filter((s) => !s.hidden && (!category || s.category === category) && (!group || groups[group]?.includes(s.category)) && (!orgId || s.orgId === orgId) && (!topic || (s.topic ?? "Agriculture") === topic) && (!forMe || schemeForViewer(c.d, c.user, s)) && (!q || `${s.name} ${s.description}`.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => schemeDTO(v, s));
});

route("GET", "/schemes/:id", (c) => {
  const s = c.d.schemes.find((x) => x.id === c.params.id && !x.hidden);
  if (!s) throw notFound("Scheme");
  return schemeDTO(view(c), s);
});

route("POST", "/schemes", async (c) => {
  const u = requireCap(c.user, "scheme:publish");
  const input = await c.body(schemeSchema);
  // Only organisation accounts publish under their own identity; admin publishes for the first org (e.g. on its behalf).
  const org = c.d.organizations.find((o) => o.userId === u.id) ?? (u.role === "ADMIN" ? c.d.organizations[0] : undefined);
  if (!org) throw forbidden("Only verified organisation accounts can publish schemes.");
  const scheme: GovernmentScheme = { id: newId("s"), orgId: org.id, ...input, deadline: input.deadline, hidden: false, createdAt: new Date().toISOString(), isDemo: false };
  c.d.schemes.push(scheme);
  c.d.follows.filter((f) => f.followingId === org.userId).forEach((f) => notify(c.d, f.followerId, "GOVERNMENT", scheme.category === "ALERT" ? `Alert: ${scheme.name}` : `New: ${scheme.name}`, scheme.description.slice(0, 90), `/schemes/${scheme.id}`));
  persist();
  return schemeDTO(view(c), scheme);
});

// ───────────── Events ─────────────
route("GET", "/events", (c) => {
  const v = view(c);
  const category = c.query.get("category");
  const when = c.query.get("when") ?? "upcoming";
  const q = (c.query.get("q") ?? "").toLowerCase();
  const district = c.query.get("district")?.toLowerCase();
  const mine = c.query.get("mine") === "1";
  const now = Date.now();
  const rows = c.d.events
    .filter((e) => (!e.hidden || e.organizerId === c.user?.id) && (!category || e.category === category) && (!district || e.district?.toLowerCase() === district) && (!mine || e.organizerId === c.user?.id) && (!q || `${e.name} ${e.description} ${e.location}`.toLowerCase().includes(q)))
    .filter((e) => (when === "past" ? eventStatus(e, now) === "ENDED" : eventStatus(e, now) !== "ENDED"))
    .sort((a, b) => (when === "past" ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
  return rows.map((e) => eventDTO(v, e));
});

route("GET", "/events/:id", (c) => {
  const e = c.d.events.find((x) => x.id === c.params.id && (!x.hidden || x.organizerId === c.user?.id || c.user?.role === "ADMIN"));
  if (!e) throw notFound("Event");
  return eventDTO(view(c), e);
});

route("POST", "/events", async (c) => {
  const u = requireCap(c.user, "event:create");
  const input = await c.body(eventSchema.and(z.object({ withLive: z.boolean().optional() })));
  const ev: AgriEvent = {
    id: newId("e"),
    organizerId: u.id,
    name: input.name,
    category: input.category,
    description: input.description,
    topics: input.topics ?? [],
    location: input.location,
    district: input.district,
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
    scene: "sunrise",
    hidden: false,
    createdAt: new Date().toISOString(),
    isDemo: false,
  };
  c.d.events.push(ev);
  if (input.withLive && (u.role === "ADMIN" || ["EXPERT", "GOVERNMENT", "FPO"].includes(u.role))) {
    c.d.liveSessions.push({ id: newId("live"), eventId: ev.id, hostId: u.id, title: ev.name, description: ev.description, status: "SCHEDULED", scheduledAt: ev.startsAt, viewerCount: 0, scene: ev.scene, hidden: false, createdAt: new Date().toISOString(), isDemo: false });
  }
  c.d.follows.filter((f) => f.followingId === u.id).forEach((f) => notify(c.d, f.followerId, "EVENT", `New event: ${ev.name}`, ev.location, `/events/${ev.id}`));
  persist();
  return eventDTO(view(c), ev);
});

function regFor(c: Ctx, eventId: string) {
  const u = requireUser(c.user);
  const e = c.d.events.find((x) => x.id === eventId && !x.hidden);
  if (!e) throw notFound("Event");
  let reg = c.d.eventRegistrations.find((r) => r.eventId === eventId && r.userId === u.id);
  if (!reg) {
    reg = { eventId, userId: u.id, registered: false, reminder: false, isDemo: false };
    c.d.eventRegistrations.push(reg);
  }
  return { u, e, reg };
}

route("POST", "/events/:id/register", async (c) => {
  const { u, e, reg } = regFor(c, c.params.id!);
  const { on } = await c.body(z.object({ on: z.boolean() }));
  if (on && eventStatus(e) === "ENDED") throw badRequest("This event has already ended.");
  reg.registered = on;
  if (on) {
    reg.reminder = true;
    notify(c.d, e.organizerId, "EVENT", "New registration", `${u.name} registered for ${e.name}.`, `/events/${e.id}`);
  }
  persist();
  return eventDTO(view(c), e);
});

route("POST", "/events/:id/reminder", async (c) => {
  const { e, reg } = regFor(c, c.params.id!);
  const { on } = await c.body(z.object({ on: z.boolean() }));
  reg.reminder = on;
  persist();
  return eventDTO(view(c), e);
});

// ───────────── Live ─────────────
route("GET", "/live", (c) => {
  const order = { LIVE: 0, SCHEDULED: 1, ENDED: 2 } as const;
  return c.d.liveSessions
    .filter((l) => !l.hidden)
    .sort((a, b) => order[a.status] - order[b.status] || a.scheduledAt.localeCompare(b.scheduledAt))
    .map((l) => liveDTO(view(c), l));
});

route("GET", "/live/:id", (c) => {
  const l = c.d.liveSessions.find((x) => x.id === c.params.id && !x.hidden);
  if (!l) throw notFound("Live session");
  return liveDTO(view(c), l);
});

route("GET", "/live/:id/messages", (c): LiveMessageDTO[] => {
  const only = c.query.get("questions") === "1";
  return c.d.liveMessages
    .filter((m) => m.sessionId === c.params.id && (!only || m.isQuestion))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-100)
    .map((m) => ({ id: m.id, body: m.body, isQuestion: m.isQuestion, createdAt: m.createdAt, user: summaryById(c.d, m.userId) }));
});

route("POST", "/live/:id/messages", async (c) => {
  const u = requireUser(c.user);
  const l = c.d.liveSessions.find((x) => x.id === c.params.id && !x.hidden);
  if (!l) throw notFound("Live session");
  const input = await c.body(liveMessageSchema);
  assertSafeText(input.body);
  const m = { id: newId("lm"), sessionId: l.id, userId: u.id, body: input.body, isQuestion: input.isQuestion, createdAt: new Date().toISOString(), isDemo: false };
  c.d.liveMessages.push(m);
  if (input.isQuestion) notify(c.d, l.hostId, "EXPERT", "New question in your live session", input.body.slice(0, 80), `/live/${l.id}`);
  persist();
  return { id: m.id, body: m.body, isQuestion: m.isQuestion, createdAt: m.createdAt, user: summaryById(c.d, u.id) } satisfies LiveMessageDTO;
});

route("POST", "/live", async (c) => {
  const u = requireCap(c.user, "live:host");
  const input = await c.body(liveScheduleSchema);
  if (input.eventId && !c.d.events.some((e) => e.id === input.eventId)) throw notFound("Event");
  const session: LiveSession = { id: newId("live"), eventId: input.eventId, hostId: u.id, title: input.title, description: input.description, status: "SCHEDULED", scheduledAt: new Date(input.scheduledAt).toISOString(), viewerCount: 0, scene: "classroom", hidden: false, createdAt: new Date().toISOString(), isDemo: false };
  c.d.liveSessions.push(session);
  c.d.follows.filter((f) => f.followingId === u.id).forEach((f) => notify(c.d, f.followerId, "EVENT", `Live session scheduled: ${session.title}`, "Tap to add a reminder.", `/live/${session.id}`));
  persist();
  return liveDTO(view(c), session);
});

route("POST", "/live/:id/status", async (c) => {
  const u = requireUser(c.user);
  const l = c.d.liveSessions.find((x) => x.id === c.params.id && (x.hostId === u.id || u.role === "ADMIN"));
  if (!l) throw notFound("Live session");
  const { status } = await c.body(z.object({ status: z.enum(["LIVE", "ENDED"]) }));
  l.status = status;
  persist();
  return liveDTO(view(c), l);
});
