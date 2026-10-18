/**
 * Domain model. Mirrors prisma/schema.prisma so the demo store and the
 * production Prisma repositories are interchangeable.
 * Every persisted entity carries `isDemo` so seed data can be purged in one query.
 */

export type Role = "FARMER" | "BUYER" | "EXPERT" | "GOVERNMENT" | "FPO" | "PROFESSIONAL" | "ADMIN";
export type Visibility = "PRIVATE" | "CONNECTIONS" | "BUYERS" | "FPO" | "PUBLIC";
export type Language = "en" | "hi" | "hinglish";
export type VerificationKind = "FARMER" | "BUYER" | "EXPERT" | "ORGANIZATION" | "FPO" | "PROFESSIONAL" | "BUSINESS";
export type UserStatus = "ACTIVE" | "SUSPENDED";
export type Season = "Rabi" | "Kharif" | "Zaid";
export type Unit = "QUINTAL" | "KG" | "TONNE";

export interface Demoable {
  isDemo: boolean;
}

export type NotificationType =
  | "GOVERNMENT"
  | "EVENT"
  | "ENQUIRY"
  | "EXPERT"
  | "COMMUNITY"
  | "CROP"
  | "LEARNING"
  | "MARKET"
  | "WEATHER"
  | "FOLLOW"
  | "COMMENT"
  | "LIKE"
  | "AI"
  | "SERVICE"
  | "WORK";

export type NotificationPrefs = Record<NotificationType, boolean>;

export interface User extends Demoable {
  id: string;
  role: Role;
  name: string;
  handle: string;
  email?: string;
  phone?: string;
  phoneVerified?: boolean;
  passwordHash?: string;
  hue: number; // avatar tint
  headline?: string;
  verifiedAt?: string; // ONLY admins can set this (see verification service)
  verifiedBy?: string;
  verificationStatus?: VerificationStatus;
  verificationBadgeType?: "PHONE" | "EMAIL" | "BUSINESS" | "ORGANIZATION" | "GOVERNMENT" | "PROFESSIONAL";
  verificationExpiresAt?: string;
  status: UserStatus;
  language: Language;
  notificationPrefs: NotificationPrefs;
  /** When false, feed & opportunities ignore profile signals (location, crops, interactions). */
  personalization: boolean;
  createdAt: string;
}

export interface PrivacySettings {
  profile: Visibility;
  income: Visibility;
  financialRecords: Visibility;
  phone: Visibility;
  produce: Visibility;
  farmPhotos: Visibility;
  locationPrecision: "VILLAGE" | "DISTRICT";
}

export interface Certification {
  id: string;
  title: string;
  issuer: string;
  year: number;
}
export interface Achievement {
  id: string;
  title: string;
  year: number;
  description: string;
}
export interface PortfolioItem {
  id: string;
  title: string;
  year: number;
  crop: string;
  areaAcres: number;
  yieldText: string;
  method: string;
  description: string;
  scene: SceneKind;
}
export interface MediaItem {
  id: string;
  kind: "PHOTO" | "VIDEO";
  caption: string;
  scene: SceneKind;
}

export type SceneKind =
  | "wheat"
  | "mustard"
  | "bajra"
  | "chickpea"
  | "vegetables"
  | "dairy"
  | "orchard"
  | "irrigation"
  | "tractor"
  | "sunrise"
  | "market"
  | "classroom"
  | "health"
  | "organic"
  | "workshop"
  | "carpentry"
  | "tailoring"
  | "pottery"
  | "road"
  | "construction"
  | "digital";

export const SCENE_KIND_LIST = ["wheat", "mustard", "bajra", "chickpea", "vegetables", "dairy", "orchard", "irrigation", "tractor", "sunrise", "market", "classroom", "health", "organic", "workshop", "carpentry", "tailoring", "pottery", "road", "construction", "digital"] as const satisfies readonly SceneKind[];

export interface FarmerProfile extends Demoable {
  userId: string;
  village: string;
  district: string;
  state: string;
  farmingSince: number; // year
  languages: string[];
  specialization: string;
  methods: string[];
  livestock: string[];
  story: string;
  skills: string[];
  certifications: Certification[];
  achievements: Achievement[];
  portfolio: PortfolioItem[];
  media: MediaItem[];
  interests: string[];
  fpoIds: string[];
  privacy: PrivacySettings;
}

export interface BuyerProfile extends Demoable {
  userId: string;
  businessName: string;
  industry: string;
  district: string;
  state: string;
  about: string;
  cropsPurchased: string[];
  website?: string;
  contactOptions: ("PLATFORM_MESSAGE" | "PHONE_ON_REQUEST")[];
}

export type ExpertCategory = "Agronomist" | "Veterinarian" | "Soil Expert" | "Researcher" | "KVK Expert";

export interface ExpertProfile extends Demoable {
  userId: string;
  category: ExpertCategory;
  qualification: string;
  organization: string;
  specialization: string[];
  experienceYears: number;
  district: string;
  state: string;
  about: string;
  languages: string[];
}

/** Government / agriculture organisation (account role GOVERNMENT). */
export interface Organization extends Demoable {
  id: string;
  userId: string;
  name: string;
  department: string;
  website: string;
  district?: string;
  state: string;
  about: string;
}

export interface Fpo extends Demoable {
  id: string;
  userId: string;
  name: string;
  district: string;
  state: string;
  about: string;
  crops: string[];
  foundedYear: number;
  memberIds: string[]; // farmer user ids
}

export interface Farm extends Demoable {
  id: string;
  ownerId: string;
  name: string;
  areaAcres: number;
  soil: string;
  irrigation: string;
  village: string;
  district: string;
  scene: SceneKind;
  history: { year: number; crop: string }[];
  createdAt: string;
}

export type CropStatus = "PLANNED" | "GROWING" | "HARVESTED" | "SOLD";

export interface Crop extends Demoable {
  id: string;
  ownerId: string;
  farmId: string;
  name: string;
  experienceYears: number;
  season: Season;
  areaAcres: number;
  method: string;
  typicalYieldQtlPerAcre: number;
  status: CropStatus;
  createdAt: string;
}

export const STAGE_KEYS = [
  "landPrep",
  "seedSelection",
  "sowing",
  "irrigation",
  "fertilization",
  "pestManagement",
  "harvest",
  "sale",
] as const;
export type StageKey = (typeof STAGE_KEYS)[number];
export interface StageRecord {
  done: boolean;
  date?: string;
  note?: string;
}

export interface CropCycle extends Demoable {
  id: string;
  cropId: string;
  farmId: string;
  ownerId: string;
  season: Season;
  year: number;
  areaAcres: number;
  seed?: string;
  stages: Record<StageKey, StageRecord>;
  status: CropStatus;
  createdAt: string;
}

export const EXPENSE_CATEGORIES = ["SEED", "FERTILIZER", "IRRIGATION", "LABOUR", "PESTICIDE", "MACHINERY", "OTHER"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface FarmExpense extends Demoable {
  id: string;
  cycleId: string;
  ownerId: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note?: string;
}

export interface Harvest extends Demoable {
  id: string;
  cycleId: string;
  ownerId: string;
  date: string;
  quantityQtl: number;
  soldQtl: number;
  sellingPricePerQtl: number;
}

export interface Location {
  village?: string;
  district: string;
  state: string;
}

export type Grade = "A" | "B" | "C" | "Unsorted";

export interface ProduceListing extends Demoable {
  id: string;
  ownerId: string;
  crop: string;
  variety?: string;
  quantity: number;
  unit: Unit;
  expectedPrice: number; // ₹ per unit
  location: Location;
  harvestDate: string;
  grade: Grade;
  method: string;
  organic: boolean;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "CLOSED";
  fpoId?: string;
  description: string;
  hidden: boolean;
  createdAt: string;
}

export interface BuyerRequirement extends Demoable {
  id: string;
  buyerId: string;
  crop: string;
  quantity: number;
  unit: Unit;
  district: string;
  state: string;
  windowStart: string;
  windowEnd: string;
  notes: string;
  status: "OPEN" | "FULFILLED" | "CLOSED";
  hidden: boolean;
  createdAt: string;
}

export interface Enquiry extends Demoable {
  id: string;
  listingId?: string;
  requirementId?: string;
  buyerId: string;
  farmerId: string;
  conversationId: string;
  message: string;
  status: "NEW" | "REPLIED" | "CLOSED";
  createdAt: string;
}

export interface Follow extends Demoable {
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface Connection extends Demoable {
  id: string;
  requesterId: string;
  receiverId: string;
  status: "PENDING" | "ACCEPTED";
  createdAt: string;
}

export type PostKind =
  | "POST"
  | "TIP"
  | "ANNOUNCEMENT"
  | "EVENT"
  | "STORY"
  | "MARKET"
  | "WEATHER"
  | "QUESTION"
  | "EXPERT_ANSWER"
  | "WORK"
  | "SKILL"
  | "OPPORTUNITY"
  | "TUTORIAL"
  | "SERVICE";

export interface Post extends Demoable {
  id: string;
  authorId: string;
  kind: PostKind;
  body: string;
  tags: string[];
  scene?: SceneKind;
  imageUrl?: string;
  communityId?: string;
  crop?: string;
  district?: string;
  state?: string;
  linkedEventId?: string;
  hidden: boolean;
  createdAt: string;
}

export type TargetType = "POST" | "REEL" | "COMMENT" | "QUESTION";

export interface Comment extends Demoable {
  id: string;
  targetType: TargetType;
  targetId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Like extends Demoable {
  userId: string;
  targetType: TargetType;
  targetId: string;
  createdAt: string;
}

export interface SavedItem extends Demoable {
  userId: string;
  targetType: "POST" | "REEL" | "LISTING" | "SCHEME" | "EVENT" | "FARMER" | "PROFESSIONAL" | "WORK" | "SERVICE";
  targetId: string;
  createdAt: string;
}

export const REEL_CATEGORIES = [
  "Crop Tips",
  "Machinery",
  "Government",
  "Expert Advice",
  "Farming Hacks",
  "Farmer Stories",
  "Dairy",
  "Organic Farming",
  "Market Education",
  "Healthcare Awareness",
  "Skill Tutorials",
  "Work Showcase",
  "Trade Tips",
  "Career Advice",
  "Workplace Safety",
] as const;
export type ReelCategory = (typeof REEL_CATEGORIES)[number];

export interface Reel extends Demoable {
  id: string;
  authorId: string;
  caption: string;
  category: ReelCategory;
  tags: string[];
  scene: SceneKind;
  durationSec: number;
  /** Real playable media (object-storage URL). Null for seeded demo reels. */
  videoUrl?: string;
  posterUrl?: string;
  hidden: boolean;
  createdAt: string;
}

export interface StoryItem extends Demoable {
  id: string;
  kind: "GOVERNMENT" | "TIP" | "EVENT" | "FPO" | "FARMER" | "MARKET";
  title: string;
  body: string;
  authorId: string;
  link: string;
  scene: SceneKind;
  createdAt: string;
  expiresAt: string;
}

export type CommunityKind = "CROP" | "LOCATION" | "METHOD" | "LIVESTOCK" | "MACHINERY" | "PROFESSION";

export interface Community extends Demoable {
  id: string;
  name: string;
  kind: CommunityKind;
  description: string;
  scene: SceneKind;
  createdBy: string;
  rules: string[];
  hidden: boolean;
  createdAt: string;
}

export interface CommunityMember extends Demoable {
  communityId: string;
  userId: string;
  role: "MEMBER" | "MODERATOR";
  joinedAt: string;
}

export interface GovernmentScheme extends Demoable {
  id: string;
  orgId: string; // Organization.id
  name: string;
  category: "SCHEME" | "SUBSIDY" | "INSURANCE" | "CREDIT" | "TRAINING" | "NOTIFICATION" | "ALERT";
  state: string;
  description: string;
  eligibility: string[];
  benefits: string[];
  documents: string[];
  applicationMethod: string;
  officialSource: string;
  deadline?: string;
  hidden: boolean;
  createdAt: string;
  /**
   * Who the entry is for: profession category ids ("pc_trades"…), profession ids, or "ALL".
   * Missing/empty = the original agriculture entries, shown to farmers.
   */
  audience?: string[];
  /** Subject area for the expanded (non-farm) government hub. */
  topic?: SchemeTopic;
}

export const SCHEME_TOPICS = ["Agriculture", "Skill development", "Employment", "Apprenticeship", "Entrepreneurship", "Worker welfare", "Safety"] as const;
export type SchemeTopic = (typeof SCHEME_TOPICS)[number];

export const EVENT_CATEGORIES = [
  "Kisan Mela",
  "Agriculture Expo",
  "Government Camp",
  "Training",
  "FPO Meeting",
  "Machinery Demo",
  "Crop Workshop",
  "Skill Camp",
  "Job Fair",
  "Trade Meetup",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export interface AgriEvent extends Demoable {
  id: string;
  organizerId: string; // user id
  name: string;
  category: EventCategory;
  description: string;
  topics: string[];
  location: string;
  district?: string;
  startsAt: string;
  endsAt: string;
  scene: SceneKind;
  hidden: boolean;
  createdAt: string;
}

export interface EventRegistration extends Demoable {
  eventId: string;
  userId: string;
  registered: boolean;
  reminder: boolean;
}

export interface LiveSession extends Demoable {
  id: string;
  eventId?: string;
  hostId: string;
  title: string;
  description: string;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  scheduledAt: string;
  viewerCount: number;
  scene: SceneKind;
  /** Real stream / HLS URL once a streaming provider is wired. Null in demo. */
  streamUrl?: string;
  hidden: boolean;
  createdAt: string;
}

export interface LiveMessage extends Demoable {
  id: string;
  sessionId: string;
  userId: string;
  body: string;
  isQuestion: boolean;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
}

export interface CourseModule extends Demoable {
  id: string;
  courseId: string;
  order: number;
  title: string;
  kind: "VIDEO" | "ARTICLE" | "QUIZ";
  durationMin: number;
  body: string;
  quiz?: QuizQuestion[];
}

export interface Course extends Demoable {
  id: string;
  title: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  outcomes: string[];
  authorId: string;
  scene: SceneKind;
  hidden: boolean;
  createdAt: string;
  /** Professions this course is for. Empty/undefined = general farming content (shown to farmers). */
  professionIds?: string[];
}

export interface CourseProgress extends Demoable {
  userId: string;
  courseId: string;
  completedModuleIds: string[];
  quizScores: Record<string, number>;
  certificateId?: string;
  updatedAt: string;
}

export interface Certificate extends Demoable {
  id: string;
  userId: string;
  courseId: string;
  code: string;
  issuedAt: string;
}

export const QUESTION_CATEGORIES = ["Crop", "Soil", "Pest", "Irrigation", "Fertilizer", "Livestock", "Machinery"] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export interface ExpertQuestion extends Demoable {
  id: string;
  askerId: string;
  category: QuestionCategory;
  crop?: string;
  district?: string;
  body: string;
  imageUrl?: string;
  expertId?: string; // directed question
  status: "OPEN" | "ANSWERED";
  hidden: boolean;
  createdAt: string;
}

export interface ExpertAnswer extends Demoable {
  id: string;
  questionId: string;
  expertId: string;
  body: string;
  helpful: number;
  createdAt: string;
}

export interface Notification extends Demoable {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Conversation extends Demoable {
  id: string;
  participantIds: string[];
  context?: { kind: "LISTING" | "REQUIREMENT" | "QUESTION" | "DIRECT" | "SERVICE" | "OPPORTUNITY"; id?: string; title: string };
  createdAt: string;
  updatedAt: string;
}

export interface Message extends Demoable {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachments: { name: string; url: string }[];
  readBy: string[];
  createdAt: string;
}

export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "NEEDS_MORE_INFORMATION"
  | "VERIFIED_EMAIL"
  | "VERIFIED_PHONE"
  | "VERIFIED_BUSINESS"
  | "VERIFIED_ORGANIZATION"
  | "VERIFIED_GOVERNMENT"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "REVOKED";

export type VerificationCategory =
  | "PROFESSIONAL"
  | "BUYER"
  | "EXPERT"
  | "BUSINESS"
  | "ORGANIZATION"
  | "GOVERNMENT";

export type GovernmentCategory =
  | "CENTRAL_GOVERNMENT"
  | "STATE_GOVERNMENT"
  | "DEPARTMENT"
  | "DISTRICT_ADMINISTRATION"
  | "MUNICIPAL_LOCAL_BODY"
  | "PUBLIC_INSTITUTION";

export interface VerificationAuditEvent {
  id: string;
  action: "REQUESTED" | "EMAIL_CHALLENGE" | "DOMAIN_CHALLENGE" | "MORE_INFO_REQUESTED" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";
  actorId: string;
  note?: string;
  timestamp: string;
}

export interface VerificationChallenge {
  type: "EMAIL" | "DOMAIN";
  target: string;
  tokenHash: string;
  status: "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";
  expiresAt: string;
  verifiedAt?: string;
  attempts: number;
}

export interface VerificationRequest extends Demoable {
  id: string;
  userId: string;
  kind: VerificationKind;
  category?: VerificationCategory;
  governmentCategory?: GovernmentCategory;
  legalName?: string;
  website?: string;
  orgEmail?: string;
  registrationNumber?: string;
  note: string;
  /** Business verification targets a Business row (not the person). */
  targetId?: string;
  documentLabels: string[]; // labels only — documents live in private object storage
  status: VerificationStatus;
  challenges?: VerificationChallenge[];
  reviewedBy?: string;
  reviewNote?: string;
  expiresAt?: string;
  auditTrail?: VerificationAuditEvent[];
  createdAt: string;
  updatedAt?: string;
}

export type ReportTarget = "POST" | "REEL" | "COMMENT" | "USER" | "LISTING" | "QUESTION" | "MESSAGE" | "REQUIREMENT" | "SERVICE" | "OPPORTUNITY" | "BUSINESS";
export const REPORT_REASONS = ["Spam", "Fake profile", "Scam or fraud", "Misleading information", "Harassment", "Inappropriate content", "Other"] as const;

export interface Report extends Demoable {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details?: string;
  status: "OPEN" | "ACTIONED" | "DISMISSED";
  createdAt: string;
}

export interface UserBlock extends Demoable {
  userId: string;
  targetId: string;
  kind: "BLOCK" | "MUTE";
}

export interface HealthResource extends Demoable {
  id: string;
  topic: string;
  kind: "ARTICLE" | "VIDEO" | "CONTACT" | "FACILITY";
  title: string;
  summary: string;
  steps: string[];
  emergency: boolean;
  scene: SceneKind;
  phone?: string;
  hidden: boolean;
}

export const MACHINERY_TYPES = ["Tractor", "Harvester", "Rotavator", "Sprayer", "Thresher", "Seed Drill", "Other"] as const;
export type MachineryType = (typeof MACHINERY_TYPES)[number];

export interface MachineryListing extends Demoable {
  id: string;
  ownerId: string;
  type: MachineryType;
  name: string;
  district: string;
  state: string;
  available: boolean;
  rate: number;
  rateUnit: "HOUR" | "DAY" | "ACRE";
  description: string;
  hidden: boolean;
  createdAt: string;
}

export interface AIConversation extends Demoable {
  id: string;
  userId: string;
  createdAt: string;
}

export interface AIAction {
  label: string;
  href: string;
}

export interface AIMessage extends Demoable {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  actions: AIAction[];
  followUps: string[];
  createdAt: string;
}

export interface OtpChallenge {
  id: string;
  identifier: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  /** Registration payload held until the OTP is verified. */
  pending?: { role: Role; name: string; email?: string; phone?: string; phoneVerified?: boolean; passwordHash?: string; professionId?: string; customProfession?: string; district?: string };
}

export interface Db {
  users: User[];
  farmerProfiles: FarmerProfile[];
  buyerProfiles: BuyerProfile[];
  expertProfiles: ExpertProfile[];
  organizations: Organization[];
  fpos: Fpo[];
  farms: Farm[];
  crops: Crop[];
  cropCycles: CropCycle[];
  expenses: FarmExpense[];
  harvests: Harvest[];
  listings: ProduceListing[];
  requirements: BuyerRequirement[];
  enquiries: Enquiry[];
  follows: Follow[];
  connections: Connection[];
  posts: Post[];
  comments: Comment[];
  likes: Like[];
  saved: SavedItem[];
  reels: Reel[];
  stories: StoryItem[];
  communities: Community[];
  communityMembers: CommunityMember[];
  schemes: GovernmentScheme[];
  events: AgriEvent[];
  eventRegistrations: EventRegistration[];
  liveSessions: LiveSession[];
  liveMessages: LiveMessage[];
  courses: Course[];
  courseModules: CourseModule[];
  courseProgress: CourseProgress[];
  certificates: Certificate[];
  questions: ExpertQuestion[];
  answers: ExpertAnswer[];
  notifications: Notification[];
  conversations: Conversation[];
  messages: Message[];
  verificationRequests: VerificationRequest[];
  reports: Report[];
  blocks: UserBlock[];
  healthResources: HealthResource[];
  machinery: MachineryListing[];
  aiConversations: AIConversation[];
  aiMessages: AIMessage[];
  otpChallenges: OtpChallenge[];
  // ── Phase 2: universal professional layer ──
  professionCategories: ProfessionCategory[];
  professions: Profession[];
  skillCatalog: SkillEntry[];
  professionalProfiles: ProfessionalProfile[];
  services: Service[];
  serviceRequests: ServiceRequest[];
  portfolioEntries: PortfolioEntry[];
  workHistory: WorkHistoryEntry[];
  recommendations: Recommendation[];
  workOpportunities: WorkOpportunity[];
  applications: WorkApplication[];
  businesses: Business[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — universal professional layer.
//   User → ProfessionalProfile → Profession.  FarmerProfile (+ farms, crops, produce) stays
//   untouched beneath it as the farming "extension" of a professional whose profession is Farmer.
// ─────────────────────────────────────────────────────────────────────────────

/** Declarative, profession-specific profile field (drives the dynamic profile form and sections). */
export interface AttributeField {
  key: string;
  label: string;
  type: "text" | "chips" | "number" | "select";
  options?: string[];
  hint?: string;
  placeholder?: string;
}

export type ModerationStatus = "ACTIVE" | "PENDING" | "REJECTED";

export interface ProfessionCategory extends Demoable {
  id: string;
  name: string;
  nameHi: string;
  emoji: string;
  order: number;
}

export interface Profession extends Demoable {
  id: string;
  categoryId: string;
  name: string;
  nameHi: string;
  emoji: string;
  /** Alternate search words (Hinglish / Hindi). */
  synonyms: string[];
  suggestedSkills: string[];
  suggestedServices: string[];
  /** Profession-specific profile fields (e.g. driver: vehicle types, licence). */
  attributes: AttributeField[];
  /** Adaptive dashboard flavour — see src/lib/profession-ui.ts. */
  dashboard: "FARMER" | "TRADE" | "SERVICE" | "ARTISAN" | "TECH" | "INDEPENDENT" | "AGRI_WORK" | "GENERAL";
  /** Farmer is the only profession that unlocks the farm/crop/produce modules. */
  farmModules: boolean;
  status: ModerationStatus;
  /** Custom ("Other") professions are created PENDING and need admin approval to enter the catalog. */
  custom: boolean;
  createdBy?: string;
}

export interface SkillEntry extends Demoable {
  id: string;
  name: string;
  professionIds: string[]; // empty = general
  status: ModerationStatus;
}

export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "EXPERT";
export interface ProfessionalSkill {
  name: string;
  level: SkillLevel;
  years?: number;
  /** Set server-side only — when an admin has verified the skill. Users cannot self-verify. */
  verified?: boolean;
}

export type AvailabilityStatus = "AVAILABLE" | "BUSY" | "OPEN_TO_WORK" | "NOT_AVAILABLE";
export type WorkPreference = "DAILY" | "CONTRACT" | "SEASONAL" | "PERMANENT" | "FREELANCE";
export interface Availability {
  status: AvailabilityStatus;
  days: string[]; // Mon..Sun
  note?: string;
  preferences: WorkPreference[];
  /** Expected wage — optional, shown only when the owner chooses. */
  expectedWage?: { amount: number; unit: "HOUR" | "DAY" | "MONTH" | "PROJECT" };
}

export interface ProfessionalLocation {
  village?: string;
  district: string;
  state: string;
  /** Radius the professional will travel for work. */
  serviceRadiusKm: number;
  serviceAreas: string[];
}

export interface ProfessionalProfile extends Demoable {
  /** Same id as the User (1:1) — and as FarmerProfile.userId for farmers, so old links keep resolving. */
  userId: string;
  professionId: string;
  secondaryProfessionIds: string[];
  /** Free-text profession when `professionId` is a pending custom profession. */
  customProfession?: string;
  about: string;
  /** Year they started — experience is always derived, never typed in as a number that goes stale. */
  startedYear: number;
  skills: ProfessionalSkill[];
  languages: string[];
  attributes: Record<string, string | string[] | number>;
  location: ProfessionalLocation;
  availability: Availability;
  certifications: Certification[];
  achievements: Achievement[];
  privacy: PrivacySettings;
  /** Owner's business, if any. */
  businessId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ServicePriceType = "FIXED" | "HOURLY" | "DAILY" | "PER_VISIT" | "MONTHLY" | "NEGOTIABLE";
export interface Service extends Demoable {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  price?: number;
  priceType: ServicePriceType;
  areas: string[];
  availability: string;
  media: MediaItem[];
  active: boolean;
  hidden: boolean;
  createdAt: string;
}

export type ServiceRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "AWAITING_CONFIRMATION" | "COMPLETED";
export interface ServiceRequest extends Demoable {
  id: string;
  serviceId: string;
  providerId: string;
  requesterId: string;
  date: string;
  location: Location;
  description: string;
  status: ServiceRequestStatus;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export const PORTFOLIO_CATEGORIES = ["Project", "Installation", "Repair", "Craft", "Design", "Farm", "Training", "Other"] as const;
export interface PortfolioEntry extends Demoable {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  date: string;
  skillsUsed: string[];
  media: MediaItem[];
  imageUrl?: string;
  videoUrl?: string;
  /** Extra facts (e.g. crop, area, yield for farm work). */
  meta?: Record<string, string>;
  hidden: boolean;
  createdAt: string;
}

export type WorkKind = "EMPLOYMENT" | "SELF_EMPLOYED" | "FAMILY" | "INDEPENDENT" | "SEASONAL" | "CONTRACT" | "APPRENTICESHIP";
export interface WorkHistoryEntry extends Demoable {
  id: string;
  ownerId: string;
  role: string;
  organization: string;
  kind: WorkKind;
  location: string;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM, empty = current
  description: string;
  skills: string[];
  createdAt: string;
}

export interface Recommendation extends Demoable {
  id: string;
  subjectId: string;
  authorId: string;
  relationship: "CUSTOMER" | "COLLEAGUE" | "EMPLOYER" | "NEIGHBOUR" | "TRAINER" | "OTHER";
  body: string;
  skill?: string;
  /** Server-set: the author had a completed job / accepted application with the subject. */
  interactionVerified: boolean;
  hidden: boolean;
  createdAt: string;
}

export const WORK_KINDS = ["JOB", "DAILY", "CONTRACT", "SEASONAL", "FREELANCE", "SERVICE_REQUEST", "APPRENTICESHIP", "TRAINING"] as const;
export type WorkOpportunityKind = (typeof WORK_KINDS)[number];
export interface WorkOpportunity extends Demoable {
  id: string;
  posterId: string;
  businessId?: string;
  title: string;
  description: string;
  kind: WorkOpportunityKind;
  professionIds: string[];
  skills: string[];
  openings: number;
  location: Location;
  startDate?: string;
  mode: "ONSITE" | "REMOTE";
  pay: { min?: number; max?: number; unit: "HOUR" | "DAY" | "MONTH" | "PROJECT" | "NEGOTIABLE" };
  duration?: string;
  /** IN_APP keeps phone numbers private; PHONE shares the poster's number only with accepted applicants. */
  contactMethod: "IN_APP" | "PHONE";
  status: "OPEN" | "CLOSED" | "FILLED";
  hidden: boolean;
  createdAt: string;
}

export interface WorkApplication extends Demoable {
  id: string;
  opportunityId: string;
  applicantId: string;
  note: string;
  status: "APPLIED" | "SHORTLISTED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business extends Demoable {
  id: string;
  ownerId: string;
  name: string;
  kind: string;
  about: string;
  services: string[];
  professionIds: string[];
  district: string;
  state: string;
  website?: string;
  /** Admin-only — users cannot set it. */
  verifiedAt?: string;
  verifiedBy?: string;
  hidden: boolean;
  createdAt: string;
}
