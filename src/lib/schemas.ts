/**
 * Shared Zod schemas — the SAME definitions validate client forms and server API input,
 * so the two can never drift apart.
 */
import { z } from "zod";
import {
  SCENE_KIND_LIST,
  EVENT_CATEGORIES,
  EXPENSE_CATEGORIES,
  MACHINERY_TYPES,
  QUESTION_CATEGORIES,
  REEL_CATEGORIES,
  REPORT_REASONS,
  SCHEME_TOPICS,
  STAGE_KEYS,
  WORK_KINDS,
} from "@/types/domain";
import { sanitizeText } from "./utils";

const text = (min: number, max: number, label = "This field") =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`)
    .transform(sanitizeText);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .transform(sanitizeText)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const num = (label: string, min = 0, max = 1e9) =>
  z
    .number({ required_error: `${label} is required`, invalid_type_error: `Enter a number for ${label.toLowerCase()}` })
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} is too large`);

const dateStr = (label = "Date") =>
  z
    .string({ required_error: `${label} is required` })
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `${label} is not a valid date`);

export const roleSchema = z.enum(["FARMER", "PROFESSIONAL", "BUYER", "EXPERT", "GOVERNMENT", "FPO"]);
export const visibilitySchema = z.enum(["PRIVATE", "CONNECTIONS", "BUYERS", "FPO", "PUBLIC"]);
export const unitSchema = z.enum(["QUINTAL", "KG", "TONNE"]);
export const seasonSchema = z.enum(["Rabi", "Kharif", "Zaid"]);

const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
export const phoneSchema = z.string().trim().regex(phoneRegex, "Enter a valid 10-digit Indian mobile number");

// ───── auth ─────
export const registerSchema = z
  .object({
    role: roleSchema,
    name: text(2, 80, "Name"),
    phone: phoneSchema.optional().or(z.literal("")).transform((v) => v || undefined),
    email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")).transform((v) => v || undefined),
    password: z.string().min(8, "Password must be at least 8 characters").max(100).optional().or(z.literal("")).transform((v) => v || undefined),
    district: optionalText(60),
    /** Profession chosen during sign-up (PROFESSIONAL accounts). "pr_farmer" creates a Farmer account. */
    professionId: z.string().max(60).optional(),
    /** "Other" — free-text profession, created PENDING for admin moderation. */
    customProfession: optionalText(60),
  })
  .refine((v) => v.phone || v.email, { message: "Enter a phone number or an email", path: ["phone"] })
  .refine((v) => v.role !== "PROFESSIONAL" || v.professionId || v.customProfession, { message: "Choose your profession", path: ["professionId"] });

export const loginPhoneSchema = z.object({ phone: phoneSchema });
export const loginEmailSchema = z.object({
  email: z.string().trim().min(3, "Enter a valid email or phone number"),
  password: z.string().min(1, "Password is required"),
});
export const otpVerifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your phone number or email"),
});
export const passwordResetConfirmSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(100),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(100),
});

// ───── profile ─────
export const certificationSchema = z.object({ id: z.string(), title: text(2, 120, "Title"), issuer: text(2, 120, "Issuer"), year: num("Year", 1980, 2100) });
export const achievementSchema = z.object({ id: z.string(), title: text(2, 120, "Title"), year: num("Year", 1980, 2100), description: text(0, 400) });
export const portfolioSchema = z.object({
  id: z.string(),
  title: text(2, 120, "Title"),
  year: num("Year", 1980, 2100),
  crop: text(2, 60, "Crop"),
  areaAcres: num("Area", 0, 100000),
  yieldText: text(1, 120, "Yield"),
  method: text(2, 80, "Method"),
  description: text(0, 500),
  scene: z.enum(SCENE_KIND_LIST),
});

export const farmerProfileSchema = z.object({
  village: text(2, 80, "Village"),
  district: text(2, 60, "District"),
  state: text(2, 60, "State"),
  farmingSince: num("Farming since", 1950, new Date().getFullYear()),
  languages: z.array(z.string().max(30)).max(10),
  specialization: text(2, 160, "Specialisation"),
  methods: z.array(z.string().max(40)).max(8),
  livestock: z.array(z.string().max(40)).max(10),
  story: text(0, 1200),
  skills: z.array(z.string().trim().min(2).max(60)).max(20),
  interests: z.array(z.string().max(40)).max(15),
  certifications: z.array(certificationSchema).max(20),
  achievements: z.array(achievementSchema).max(20),
  portfolio: z.array(portfolioSchema).max(12),
});
export type FarmerProfileInput = z.infer<typeof farmerProfileSchema>;

export const identitySchema = z.object({
  name: text(2, 80, "Name"),
  headline: optionalText(140),
  language: z.enum(["en", "hi", "hinglish"]).optional(),
});

export const buyerProfileSchema = z.object({
  businessName: text(2, 100, "Business name"),
  industry: text(2, 100, "Industry"),
  district: text(2, 60, "District"),
  state: text(2, 60, "State"),
  about: text(10, 800, "About"),
  cropsPurchased: z.array(z.string().max(40)).min(1, "Add at least one crop").max(15),
  website: z.string().url("Enter a valid URL (https://…)").optional().or(z.literal("")).transform((v) => v || undefined),
});
export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;

export const expertProfileSchema = z.object({
  category: z.enum(["Agronomist", "Veterinarian", "Soil Expert", "Researcher", "KVK Expert"]),
  qualification: text(2, 120, "Qualification"),
  organization: text(2, 120, "Organisation"),
  specialization: z.array(z.string().max(60)).min(1, "Add at least one specialisation").max(12),
  experienceYears: num("Experience", 0, 70),
  district: text(2, 60, "District"),
  state: text(2, 60, "State"),
  about: text(10, 800, "About"),
});
export type ExpertProfileInput = z.infer<typeof expertProfileSchema>;

export const organizationProfileSchema = z.object({
  name: text(2, 120, "Name"),
  about: text(10, 800, "About"),
  website: z.string().url("Enter a valid URL (https://…)").optional().or(z.literal("")).transform((v) => v || undefined),
  district: optionalText(60),
});

export const privacySchema = z.object({
  profile: visibilitySchema,
  income: visibilitySchema,
  financialRecords: visibilitySchema,
  phone: visibilitySchema,
  produce: visibilitySchema,
  farmPhotos: visibilitySchema,
  locationPrecision: z.enum(["VILLAGE", "DISTRICT"]),
});

export const notificationPrefsSchema = z.record(z.string(), z.boolean());

// ───── farm management ─────
export const farmSchema = z.object({
  name: text(2, 80, "Farm name"),
  areaAcres: num("Area", 0.1, 100000),
  soil: text(2, 60, "Soil type"),
  irrigation: text(2, 60, "Irrigation"),
  village: text(2, 80, "Village"),
  district: text(2, 60, "District"),
});
export type FarmInput = z.infer<typeof farmSchema>;

export const cropSchema = z.object({
  farmId: z.string().min(1, "Choose a farm"),
  name: text(2, 60, "Crop name"),
  experienceYears: num("Experience", 0, 70),
  season: seasonSchema,
  areaAcres: num("Area", 0.1, 100000),
  method: text(2, 60, "Farming method"),
  typicalYieldQtlPerAcre: num("Typical yield", 0, 1000),
});
export type CropInput = z.infer<typeof cropSchema>;

export const cycleStartSchema = z.object({
  season: seasonSchema,
  year: num("Year", 2000, 2100),
  areaAcres: num("Area", 0.1, 100000),
  seed: optionalText(120),
});
export type CycleStartInput = z.infer<typeof cycleStartSchema>;

export const stageUpdateSchema = z.object({
  stage: z.enum(STAGE_KEYS),
  done: z.boolean(),
  date: dateStr("Date").optional().or(z.literal("")).transform((v) => v || undefined),
  note: optionalText(200),
});

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: num("Amount", 1, 1e8),
  date: dateStr(),
  note: optionalText(160),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const harvestSchema = z.object({
  date: dateStr("Harvest date"),
  quantityQtl: num("Quantity", 0.1, 1e6),
  soldQtl: num("Quantity sold", 0, 1e6),
  sellingPricePerQtl: num("Selling price", 0, 1e7),
});
export type HarvestInput = z.infer<typeof harvestSchema>;

// ───── social ─────
export const postSchema = z.object({
  kind: z.enum(["POST", "TIP", "ANNOUNCEMENT", "EVENT", "STORY", "MARKET", "WEATHER", "QUESTION", "EXPERT_ANSWER"]).default("POST"),
  body: text(3, 2000, "Post"),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  imageUrl: z.string().max(300).optional().or(z.literal("")).transform((v) => v || undefined),
  communityId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  crop: optionalText(40),
});
export type PostInput = z.input<typeof postSchema>;

export const reelSchema = z.object({
  caption: text(3, 300, "Caption"),
  category: z.enum(REEL_CATEGORIES),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  videoUrl: z.string().max(300).optional().or(z.literal("")).transform((v) => v || undefined),
  durationSec: num("Duration", 1, 180).default(30),
});
export type ReelInput = z.input<typeof reelSchema>;

export const commentSchema = z.object({
  targetType: z.enum(["POST", "REEL", "QUESTION"]),
  targetId: z.string().min(1),
  body: text(1, 600, "Comment"),
});

export const reactionSchema = z.object({ targetType: z.enum(["POST", "REEL", "QUESTION"]), targetId: z.string().min(1) });
export const saveSchema = z.object({
  targetType: z.enum(["POST", "REEL", "LISTING", "SCHEME", "EVENT", "FARMER", "PROFESSIONAL", "WORK", "SERVICE"]),
  targetId: z.string().min(1),
});

export const reportSchema = z.object({
  targetType: z.enum(["POST", "REEL", "COMMENT", "USER", "LISTING", "QUESTION", "MESSAGE", "REQUIREMENT", "SERVICE", "OPPORTUNITY", "BUSINESS"]),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  details: optionalText(400),
});

export const communitySchema = z.object({
  name: text(3, 60, "Name"),
  kind: z.enum(["CROP", "LOCATION", "METHOD", "LIVESTOCK", "MACHINERY", "PROFESSION"]),
  description: text(10, 300, "Description"),
});

// ───── market ─────
export const listingSchema = z.object({
  crop: text(2, 40, "Crop"),
  variety: optionalText(60),
  quantity: num("Quantity", 0.1, 1e7),
  unit: unitSchema,
  expectedPrice: num("Expected price", 1, 1e7),
  village: optionalText(80),
  district: text(2, 60, "District"),
  state: text(2, 60, "State"),
  harvestDate: dateStr("Harvest date"),
  grade: z.enum(["A", "B", "C", "Unsorted"]),
  method: text(2, 60, "Farming method"),
  description: text(0, 600),
});
export type ListingInput = z.infer<typeof listingSchema>;

export const requirementSchema = z
  .object({
    crop: text(2, 40, "Crop"),
    quantity: num("Quantity", 1, 1e7),
    unit: unitSchema,
    district: text(2, 60, "District"),
    state: text(2, 60, "State"),
    windowStart: dateStr("Start date"),
    windowEnd: dateStr("End date"),
    notes: text(0, 600),
  })
  .refine((v) => Date.parse(v.windowEnd) >= Date.parse(v.windowStart), { message: "End date must be after start date", path: ["windowEnd"] });
export type RequirementInput = z.infer<typeof requirementSchema>;

export const enquirySchema = z.object({ message: text(5, 800, "Message"), listingId: z.string().optional(), listingMessageOnly: z.boolean().optional() });
export const respondSchema = z.object({ message: text(5, 800, "Message"), listingId: z.string().optional() });

export const machinerySchema = z.object({
  type: z.enum(MACHINERY_TYPES),
  name: text(2, 80, "Equipment"),
  district: text(2, 60, "District"),
  state: text(2, 60, "State"),
  rate: num("Rate", 1, 1e7),
  rateUnit: z.enum(["HOUR", "DAY", "ACRE"]),
  description: text(0, 400),
});
export type MachineryInput = z.infer<typeof machinerySchema>;

// ───── knowledge ─────
export const questionSchema = z.object({
  category: z.enum(QUESTION_CATEGORIES),
  body: text(10, 1200, "Question"),
  crop: optionalText(40),
  district: optionalText(60),
  imageUrl: z.string().max(300).optional().or(z.literal("")).transform((v) => v || undefined),
  expertId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
});
export type QuestionInput = z.input<typeof questionSchema>;

export const answerSchema = z.object({ body: text(10, 2500, "Answer") });

export const eventSchema = z
  .object({
    name: text(5, 120, "Event name"),
    category: z.enum(EVENT_CATEGORIES),
    description: text(10, 1000, "Description"),
    topics: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
    location: text(3, 160, "Location"),
    district: optionalText(60),
    startsAt: dateStr("Start"),
    endsAt: dateStr("End"),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), { message: "End must be after start", path: ["endsAt"] });
export type EventInput = z.input<typeof eventSchema>;

export const schemeSchema = z.object({
  name: text(5, 140, "Scheme name"),
  category: z.enum(["SCHEME", "SUBSIDY", "INSURANCE", "CREDIT", "TRAINING", "NOTIFICATION", "ALERT"]),
  state: text(2, 60, "State"),
  description: text(10, 1200, "Description"),
  eligibility: z.array(z.string().trim().min(2).max(300)).min(1, "Add at least one eligibility point").max(12),
  benefits: z.array(z.string().trim().min(2).max(300)).min(1, "Add at least one benefit").max(12),
  documents: z.array(z.string().trim().min(2).max(200)).max(15).default([]),
  applicationMethod: text(5, 500, "Application method"),
  officialSource: z.string().trim().url("Official source must be a valid URL"),
  deadline: dateStr("Deadline").optional().or(z.literal("")).transform((v) => v || undefined),
  topic: z.enum(SCHEME_TOPICS).optional(),
  audience: z.array(z.string().trim().min(2).max(60)).max(12).optional(),
});
export type SchemeInput = z.input<typeof schemeSchema>;

export const liveScheduleSchema = z.object({
  title: text(5, 120, "Title"),
  description: text(10, 600, "Description"),
  scheduledAt: dateStr("Start time"),
  eventId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
});

export const liveMessageSchema = z.object({ body: text(1, 300, "Message"), isQuestion: z.boolean().default(false) });

export const courseProgressSchema = z.object({ moduleId: z.string().min(1), quizScore: z.number().min(0).max(100).optional() });

// ───── messaging / AI / verification ─────
export const messageSchema = z.object({
  body: text(1, 2000, "Message"),
  attachments: z.array(z.object({ name: z.string().max(80), url: z.string().startsWith("/api/files/") })).max(3).optional(),
});
export const startConversationSchema = z.object({
  userId: z.string().min(1),
  message: text(1, 2000, "Message"),
  context: z.object({ kind: z.enum(["LISTING", "REQUIREMENT", "QUESTION", "DIRECT", "SERVICE", "OPPORTUNITY"]), id: z.string().optional(), title: z.string().max(160) }).optional(),
});
export const aiChatSchema = z.object({
  conversationId: z.string().optional(),
  message: text(1, 1000, "Message"),
  locale: z.enum(["en", "hi", "hinglish"]).optional(),
});
export const verificationRequestSchema = z.object({
  note: text(10, 600, "Note"),
  documentLabels: z.array(z.string().trim().min(2).max(80)).min(1, "List at least one document you can provide").max(6),
});
export const verificationReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "NEEDS_MORE_INFORMATION", "REVOKED"]),
  note: optionalText(500),
  badgeType: z.enum(["PHONE", "EMAIL", "BUSINESS", "ORGANIZATION", "GOVERNMENT", "PROFESSIONAL"]).optional(),
  expiryDays: z.number().int().min(1).max(1825).optional(),
});
export const reportResolveSchema = z.object({ action: z.enum(["HIDE_CONTENT", "SUSPEND_USER", "DISMISS"]) });
export const blockSchema = z.object({ targetId: z.string().min(1), kind: z.enum(["BLOCK", "MUTE"]) });


// ───────────── Phase 2: professionals ─────────────
export const skillLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "EXPERT"]);
export const proSkillSchema = z.object({ name: text(2, 60, "Skill"), level: skillLevelSchema.default("INTERMEDIATE"), years: num("Years", 0, 70).optional() });
export const workPreferenceSchema = z.enum(["DAILY", "CONTRACT", "SEASONAL", "PERMANENT", "FREELANCE"]);
export const availabilitySchema = z.object({
  status: z.enum(["AVAILABLE", "BUSY", "OPEN_TO_WORK", "NOT_AVAILABLE"]),
  days: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])).max(7),
  note: optionalText(200),
  preferences: z.array(workPreferenceSchema).max(5),
  expectedWage: z.object({ amount: num("Expected wage", 0, 10_000_000), unit: z.enum(["HOUR", "DAY", "MONTH", "PROJECT"]) }).optional(),
});
export const professionalLocationSchema = z.object({
  village: optionalText(80),
  district: text(2, 60, "District"),
  state: text(2, 60, "State"),
  serviceRadiusKm: num("Service radius", 1, 1000),
  serviceAreas: z.array(z.string().trim().min(2).max(60)).max(15),
});
const attributeValue = z.union([z.string().max(120), z.array(z.string().max(60)).max(20), z.number()]);

/** PATCH /professionals/me — every field optional; omitted fields are untouched. */
export const professionalProfileSchema = z
  .object({
    professionId: z.string().max(60),
    customProfession: optionalText(60),
    secondaryProfessionIds: z.array(z.string().max(60)).max(3),
    about: text(0, 1200),
    startedYear: num("Year started", 1950, new Date().getFullYear()),
    skills: z.array(proSkillSchema).max(25),
    languages: z.array(z.string().max(30)).max(10),
    attributes: z.record(z.string().max(40), attributeValue),
    location: professionalLocationSchema,
    availability: availabilitySchema,
    certifications: z.array(certificationSchema).max(20),
    achievements: z.array(achievementSchema).max(20),
    headline: optionalText(140),
  })
  .partial();
export type ProfessionalProfileInput = z.infer<typeof professionalProfileSchema>;

export const professionalPrivacySchema = z.object({
  profile: visibilitySchema,
  phone: visibilitySchema,
  locationPrecision: z.enum(["VILLAGE", "DISTRICT"]),
});

export const servicePriceTypeSchema = z.enum(["FIXED", "HOURLY", "DAILY", "PER_VISIT", "MONTHLY", "NEGOTIABLE"]);
export const serviceSchema = z.object({
  name: text(2, 80, "Service name"),
  description: text(10, 800, "Description"),
  priceType: servicePriceTypeSchema,
  price: num("Price", 0, 10_000_000).optional(),
  areas: z.array(z.string().trim().min(2).max(60)).max(15),
  availability: text(0, 160),
  imageUrl: z.string().max(300).optional(),
  scene: z.enum(SCENE_KIND_LIST).optional(),
  active: z.boolean().optional(),
});

export const serviceRequestSchema = z.object({
  serviceId: z.string().min(1),
  date: dateStr("Preferred date"),
  village: optionalText(80),
  district: text(2, 60, "District"),
  state: text(2, 60, "State").default("Rajasthan"),
  description: text(10, 600, "Description"),
});
export const serviceRequestActionSchema = z.object({ action: z.enum(["ACCEPT", "REJECT", "CANCEL", "MARK_DONE", "CONFIRM_DONE"]), message: optionalText(300) });

export const workPortfolioSchema = z.object({
  title: text(2, 120, "Title"),
  description: text(10, 800, "Description"),
  category: text(2, 40, "Category"),
  date: dateStr("Date"),
  skillsUsed: z.array(z.string().trim().min(2).max(60)).max(12),
  imageUrl: z.string().max(300).optional(),
  videoUrl: z.string().max(300).optional(),
  scene: z.enum(SCENE_KIND_LIST).optional(),
  meta: z.record(z.string().max(40), z.string().max(120)).optional(),
});

export const WORK_KIND_LIST = ["EMPLOYMENT", "SELF_EMPLOYED", "FAMILY", "INDEPENDENT", "SEASONAL", "CONTRACT", "APPRENTICESHIP"] as const;
export const workHistorySchema = z.object({
  role: text(2, 80, "Role"),
  organization: text(2, 100, "Organisation or client"),
  kind: z.enum(WORK_KIND_LIST),
  location: text(0, 100),
  startDate: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
  endDate: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM").optional().or(z.literal("")).transform((v) => v || undefined),
  description: text(0, 600),
  skills: z.array(z.string().trim().min(2).max(60)).max(10),
});

export const recommendationSchema = z.object({
  relationship: z.enum(["CUSTOMER", "COLLEAGUE", "EMPLOYER", "NEIGHBOUR", "TRAINER", "OTHER"]),
  body: text(20, 600, "Recommendation"),
  skill: optionalText(60),
});

export const workOpportunitySchema = z.object({
  title: text(4, 120, "Title"),
  description: text(20, 1500, "Description"),
  kind: z.enum(WORK_KINDS),
  professionIds: z.array(z.string().max(60)).min(1, "Choose at least one profession").max(5),
  skills: z.array(z.string().trim().min(2).max(60)).max(12),
  openings: num("Number of people", 1, 1000),
  village: optionalText(80),
  district: text(2, 60, "District"),
  state: text(2, 60, "State").default("Rajasthan"),
  startDate: z.string().optional().or(z.literal("")).transform((v) => v || undefined).refine((v) => !v || !Number.isNaN(Date.parse(v)), "Not a valid date"),
  mode: z.enum(["ONSITE", "REMOTE"]).default("ONSITE"),
  payMin: num("Minimum pay", 0, 100_000_000).optional(),
  payMax: num("Maximum pay", 0, 100_000_000).optional(),
  payUnit: z.enum(["HOUR", "DAY", "MONTH", "PROJECT", "NEGOTIABLE"]),
  duration: optionalText(80),
  contactMethod: z.enum(["IN_APP", "PHONE"]).default("IN_APP"),
  businessId: z.string().optional(),
});
export const workApplicationSchema = z.object({ note: text(0, 500) });
export const applicationStatusSchema = z.object({ status: z.enum(["SHORTLISTED", "ACCEPTED", "REJECTED"]), message: optionalText(300) });

export const businessSchema = z.object({
  name: text(2, 100, "Business name"),
  kind: text(2, 60, "Type of business"),
  about: text(10, 800, "About"),
  services: z.array(z.string().trim().min(2).max(80)).max(15),
  professionIds: z.array(z.string().max(60)).max(8),
  district: text(2, 60, "District"),
  state: text(2, 60, "State").default("Rajasthan"),
  website: z.string().url("Enter a valid URL (https://…)").optional().or(z.literal("")).transform((v) => v || undefined),
});

// admin catalog management
export const adminProfessionSchema = z.object({
  name: text(2, 60, "Name"),
  nameHi: text(0, 60),
  emoji: text(1, 8, "Emoji"),
  categoryId: z.string().min(1),
  synonyms: z.array(z.string().max(40)).max(12).default([]),
  suggestedSkills: z.array(z.string().max(60)).max(30).default([]),
});
export const adminProfessionStatusSchema = z.object({ status: z.enum(["ACTIVE", "REJECTED"]), mergeInto: z.string().optional(), categoryId: z.string().optional() });
export const adminSkillSchema = z.object({ name: text(2, 60, "Skill"), professionIds: z.array(z.string()).max(20).default([]) });
