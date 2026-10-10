/**
 * API data-transfer objects. These are what the browser receives — never raw database rows.
 * Private fields (phone, passwordHash, financials, exact location…) only appear when
 * the server-side privacy layer allows them for the viewing user.
 */
import type {
  AttributeField,
  AvailabilityStatus,
  ProfessionalSkill,
  ServicePriceType,
  ServiceRequestStatus,
  WorkKind,
  WorkOpportunityKind,
  WorkPreference,
  Achievement,
  Certification,
  CropStatus,
  ExpenseCategory,
  ExpertCategory,
  Grade,
  HealthResource,
  Language,
  Location,
  MediaItem,
  Notification,
  NotificationPrefs,
  PortfolioItem,
  PostKind,
  PrivacySettings,
  QuestionCategory,
  ReelCategory,
  Role,
  SceneKind,
  Season,
  StageKey,
  StageRecord,
  Unit,
  Visibility,
  AIAction,
  EventCategory,
  CommunityKind,
  CourseModule,
  MachineryType,
} from "./domain";

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface UserSummary {
  id: string;
  name: string;
  handle: string;
  role: Role;
  hue: number;
  headline?: string;
  verified: boolean;
  /** Verified label such as "Verified Farmer". Only set when an admin has approved verification. */
  badge?: string;
  district?: string;
  /** Profession of a farmer/professional/expert (null for organisations, buyers). */
  profession?: { id: string; name: string; emoji: string };
  isDemo: boolean;
}

export interface Me extends UserSummary {
  email?: string;
  phone?: string;
  phoneVerified?: boolean;
  language: Language;
  notificationPrefs: NotificationPrefs;
  personalization: boolean;
  unreadNotifications: number;
  unreadMessages: number;
  profileId?: string; // organization/fpo id when applicable
  demoMode: boolean;
}

// ─────────── Social ───────────
export interface PostDTO {
  id: string;
  kind: PostKind;
  body: string;
  tags: string[];
  scene?: SceneKind;
  imageUrl?: string;
  createdAt: string;
  author: UserSummary;
  community?: { id: string; name: string };
  crop?: string;
  district?: string;
  linkedEventId?: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  followingAuthor: boolean;
  isOwn: boolean;
  official: boolean;
  isDemo: boolean;
}

export interface ReelDTO {
  id: string;
  caption: string;
  category: ReelCategory;
  tags: string[];
  scene: SceneKind;
  durationSec: number;
  videoUrl?: string;
  createdAt: string;
  author: UserSummary;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  followingAuthor: boolean;
  isOwn: boolean;
  isDemo: boolean;
}

export type FeedItem = { type: "post"; post: PostDTO } | { type: "reel"; reel: ReelDTO };

export interface CommentDTO {
  id: string;
  body: string;
  createdAt: string;
  author: UserSummary;
  isOwn: boolean;
}

export interface StoryDTO {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  scene: SceneKind;
  author: UserSummary;
  expiresAt: string;
  isDemo: boolean;
}

export interface CommunityDTO {
  id: string;
  name: string;
  kind: CommunityKind;
  description: string;
  scene: SceneKind;
  memberCount: number;
  postCount: number;
  joined: boolean;
  isModerator: boolean;
  rules: string[];
}

// ─────────── People ───────────
export interface FarmerCardDTO {
  user: UserSummary;
  village?: string;
  district: string;
  state: string;
  experienceYears: number;
  specialization: string;
  crops: string[];
  produce: { id: string; crop: string; quantity: number; unit: Unit }[];
  fpos: { id: string; userId: string; name: string }[];
  followers: number;
  distanceKm?: number | null;
  matchReason?: string;
  restricted: boolean;
}

export type ConnectionState = "NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "CONNECTED";

export interface CropDTO {
  id: string;
  name: string;
  experienceYears: number;
  season: Season;
  areaAcres: number;
  method: string;
  typicalYieldQtlPerAcre: number;
  status: CropStatus;
  farmId: string;
  farmName: string;
  currentCycleId?: string;
}

export interface FarmDTO {
  id: string;
  name: string;
  areaAcres: number;
  soil: string;
  irrigation: string;
  village: string;
  district: string;
  scene: SceneKind;
  history: { year: number; crop: string }[];
  crops: CropDTO[];
}

export interface FarmerProfileDTO {
  user: UserSummary;
  restricted: boolean;
  village?: string;
  district: string;
  state: string;
  farmingSince: number;
  experienceYears: number;
  languages: string[];
  specialization: string;
  methods: string[];
  livestock: string[];
  story: string;
  skills: string[];
  interests: string[];
  certifications: Certification[];
  achievements: Achievement[];
  portfolio: PortfolioItem[];
  media: MediaItem[];
  crops: CropDTO[];
  farms: FarmDTO[];
  produce: ListingCardDTO[];
  network: {
    followers: number;
    following: number;
    connections: number;
    farmerConnections: number;
    expertConnections: number;
    fpos: { id: string; userId: string; name: string }[];
  };
  viewer: { isSelf: boolean; isFollowing: boolean; connection: ConnectionState; saved: boolean };
  phone?: string;
  /** Present only for the profile owner. */
  privacy?: PrivacySettings;
  /** Aggregated, non-ledger financial summary shown ONLY if the owner allowed it for this viewer. */
  financialSummary?: { totalRevenueLastYear: number; avgProfitPerAcre: number } | null;
  health?: FarmHealthScore;
}

export interface BuyerCardDTO {
  user: UserSummary;
  businessName: string;
  industry: string;
  district: string;
  state: string;
  cropsPurchased: string[];
  openRequirements: number;
}

export interface BuyerProfileDTO extends BuyerCardDTO {
  about: string;
  website?: string;
  contactOptions: string[];
  requirements: RequirementDTO[];
  followers: number;
  viewer: { isSelf: boolean; isFollowing: boolean; saved: boolean };
}

export interface ExpertCardDTO {
  user: UserSummary;
  category: ExpertCategory;
  qualification: string;
  organization: string;
  specialization: string[];
  experienceYears: number;
  district: string;
  state: string;
  followers: number;
  answerCount: number;
}

export interface ExpertProfileDTO extends ExpertCardDTO {
  about: string;
  languages: string[];
  recentAnswers: { question: QuestionDTO }[];
  posts: PostDTO[];
  viewer: { isSelf: boolean; isFollowing: boolean };
}

export interface OrgCardDTO {
  user: UserSummary;
  kind: "GOVERNMENT" | "FPO";
  name: string;
  department?: string;
  district?: string;
  state: string;
  about: string;
  website?: string;
  memberCount?: number;
  crops?: string[];
  followers: number;
  isFollowing: boolean;
}

export interface OrgProfileDTO extends OrgCardDTO {
  posts: PostDTO[];
  events: EventDTO[];
  schemes: SchemeDTO[];
  listings: ListingCardDTO[];
  members: { user: UserSummary }[];
  viewer: { isSelf: boolean; isFollowing: boolean; isMember: boolean };
}

export interface UserListItem {
  user: UserSummary;
  isFollowing: boolean;
}

// ─────────── Farm management ───────────
export interface CycleStats {
  totalCost: number;
  revenue: number;
  profit: number;
  profitPerAcre: number;
  costPerQtl: number | null;
  yieldQtl: number;
  yieldPerAcre: number;
  costByCategory: { category: ExpenseCategory; amount: number }[];
}

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note?: string;
}

export interface CycleDTO {
  id: string;
  cropId: string;
  cropName: string;
  farmId: string;
  farmName: string;
  season: Season;
  year: number;
  areaAcres: number;
  seed?: string;
  status: CropStatus;
  stages: Record<StageKey, StageRecord>;
  stats: CycleStats;
  expenses: ExpenseRow[];
  harvest?: { id: string; date: string; quantityQtl: number; soldQtl: number; sellingPricePerQtl: number };
}

export interface CropDetailDTO {
  crop: CropDTO;
  cycles: CycleDTO[];
  comparison: { cycleId: string; label: string; year: number; cost: number; revenue: number; profit: number; yieldPerAcre: number }[];
}

export interface FarmHealthScore {
  score: number;
  max: number;
  parts: { key: string; label: string; points: number; max: number; done: boolean; tip: string }[];
  explanation: string;
}

export interface FarmDetailDTO {
  farm: FarmDTO;
  cycles: CycleDTO[];
  health: FarmHealthScore | null;
  isOwn: boolean;
}

export interface FarmSummaryDTO {
  totals: { cost: number; revenue: number; profit: number; acres: number };
  byYear: { year: number; cost: number; revenue: number; profit: number }[];
  byCategory: { category: ExpenseCategory; amount: number }[];
  health: FarmHealthScore;
  farms: number;
  crops: number;
}

// ─────────── Market ───────────
export interface ListingCardDTO {
  id: string;
  crop: string;
  variety?: string;
  quantity: number;
  unit: Unit;
  expectedPrice: number;
  location: Location;
  harvestDate: string;
  grade: Grade;
  method: string;
  organic: boolean;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "CLOSED";
  createdAt: string;
  owner: UserSummary;
  fpo?: { id: string; name: string };
  verifiedFarmer: boolean;
  saved: boolean;
  isOwn: boolean;
  description: string;
  isDemo: boolean;
}

export interface ListingDetailDTO extends ListingCardDTO {
  ownerCard: FarmerCardDTO | null;
  similar: ListingCardDTO[];
  enquirySent: boolean;
}

export interface RequirementDTO {
  id: string;
  buyer: UserSummary;
  businessName: string;
  crop: string;
  quantity: number;
  unit: Unit;
  district: string;
  state: string;
  windowStart: string;
  windowEnd: string;
  notes: string;
  status: "OPEN" | "FULFILLED" | "CLOSED";
  createdAt: string;
  isOwn: boolean;
  /** 0-100, how well the viewing farmer's produce matches this requirement. */
  matchScore?: number;
  responded: boolean;
  isDemo: boolean;
}

export interface MatchDTO {
  listing: ListingCardDTO;
  farmer: FarmerCardDTO | null;
  score: number;
  reasons: string[];
}

export interface EnquiryDTO {
  id: string;
  status: "NEW" | "REPLIED" | "CLOSED";
  message: string;
  createdAt: string;
  direction: "SENT" | "RECEIVED";
  counterpart: UserSummary;
  listing?: { id: string; crop: string; quantity: number; unit: Unit };
  requirement?: { id: string; crop: string };
  conversationId: string;
}

export interface MachineryDTO {
  id: string;
  type: MachineryType;
  name: string;
  district: string;
  state: string;
  available: boolean;
  rate: number;
  rateUnit: "HOUR" | "DAY" | "ACRE";
  description: string;
  owner: UserSummary;
  isOwn: boolean;
}

// ─────────── Knowledge ───────────
export interface AnswerDTO {
  id: string;
  expert: UserSummary;
  body: string;
  helpful: number;
  createdAt: string;
  markedHelpful: boolean;
}

export interface QuestionDTO {
  id: string;
  asker: UserSummary;
  category: QuestionCategory;
  crop?: string;
  district?: string;
  body: string;
  imageUrl?: string;
  status: "OPEN" | "ANSWERED";
  createdAt: string;
  expert?: UserSummary;
  answers: AnswerDTO[];
  isOwn: boolean;
  isDemo: boolean;
}

export interface CourseCardDTO {
  id: string;
  title: string;
  category: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  scene: SceneKind;
  author: UserSummary;
  moduleCount: number;
  totalMinutes: number;
  progressPct: number;
  completed: boolean;
}

export interface QuizQuestionDTO {
  id: string;
  question: string;
  options: string[];
}

export type ModuleDTO = Omit<CourseModule, "quiz" | "isDemo" | "courseId"> & { quiz?: QuizQuestionDTO[]; done: boolean };

export interface CourseDetailDTO extends CourseCardDTO {
  outcomes: string[];
  modules: ModuleDTO[];
  certificate?: { id: string; code: string; issuedAt: string; holder: string };
}

export type HealthDTO = Omit<HealthResource, "hidden" | "isDemo">;

export interface SchemeDTO {
  id: string;
  name: string;
  category: string;
  state: string;
  description: string;
  eligibility: string[];
  benefits: string[];
  documents: string[];
  applicationMethod: string;
  officialSource: string;
  deadline?: string;
  daysLeft?: number | null;
  createdAt: string;
  /** Subject area: "Agriculture" for the original entries, otherwise skill development, employment, … */
  topic: string;
  /** Profession ids / category ids this entry is for, or ["ALL"]; ["AGRICULTURE"] for farm entries. */
  audience: string[];
  org: { id: string; userId: string; name: string; department: string; website: string; verified: boolean };
  saved: boolean;
  isDemo: boolean;
}

export interface EventDTO {
  id: string;
  name: string;
  category: EventCategory;
  description: string;
  topics: string[];
  location: string;
  district?: string;
  startsAt: string;
  endsAt: string;
  scene: SceneKind;
  organizer: UserSummary;
  registered: boolean;
  reminder: boolean;
  registrationCount: number;
  liveSessionId?: string;
  status: "UPCOMING" | "LIVE" | "ENDED";
  saved: boolean;
  isOwn: boolean;
  isDemo: boolean;
}

export interface LiveDTO {
  id: string;
  title: string;
  description: string;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  scheduledAt: string;
  viewerCount: number;
  scene: SceneKind;
  host: UserSummary;
  followingHost: boolean;
  streamConnected: boolean;
  event?: { id: string; name: string };
  isHost: boolean;
  isDemo: boolean;
}

export interface LiveMessageDTO {
  id: string;
  body: string;
  isQuestion: boolean;
  createdAt: string;
  user: UserSummary;
}

// ─────────── Messaging & notifications ───────────
export type NotificationDTO = Notification;

export interface ConversationDTO {
  id: string;
  participants: UserSummary[];
  other: UserSummary;
  context?: { kind: string; id?: string; title: string };
  lastMessage?: { body: string; createdAt: string; senderId: string };
  unread: number;
  updatedAt: string;
}

export interface MessageDTO {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  read: boolean;
  attachments: { name: string; url: string }[];
}

// ─────────── Intelligence ───────────
export interface AIMessageDTO {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  actions: AIAction[];
  followUps: string[];
  createdAt: string;
}

export type OpportunityKind = "BUYER_REQUIREMENT" | "SCHEME" | "TRAINING" | "MACHINERY" | "EVENT" | "FPO" | "COURSE" | "PRODUCE" | "WORK";

export interface OpportunityDTO {
  id: string;
  kind: OpportunityKind;
  title: string;
  subtitle: string;
  reason: string;
  href: string;
  scene: SceneKind;
  badge?: string;
  deadline?: string;
  score: number;
  isDemo: boolean;
}

export interface SearchResultsDTO {
  q: string;
  counts: Record<string, number>;
  farmers: FarmerCardDTO[];
  buyers: BuyerCardDTO[];
  experts: ExpertCardDTO[];
  orgs: OrgCardDTO[];
  produce: ListingCardDTO[];
  posts: PostDTO[];
  reels: ReelDTO[];
  events: EventDTO[];
  schemes: SchemeDTO[];
  courses: CourseCardDTO[];
  communities: CommunityDTO[];
  // KaamSetu: universal professionals, services, opportunities and businesses (farmers stay in `farmers`).
  professionals: ProfessionalCardDTO[];
  services: ServiceDTO[];
  opportunities: WorkOpportunityDTO[];
  businesses: BusinessCardDTO[];
}

export interface HomeDTO {
  greetingName: string;
  role: Role;
  currentCrop?: { cropId: string; name: string; areaAcres: number; stageLabel: string; sownOn?: string };
  nextActivity?: { label: string; date: string; cropName: string; cropId: string };
  market?: { crop: string; avgPrice: number; unit: Unit; listings: number };
  event?: EventDTO;
  government: { count: number; latest?: SchemeDTO };
  learning?: { courseId: string; title: string; progressPct: number };
  community: { newPosts: number; name?: string; id?: string };
  stories: StoryDTO[];
  health?: FarmHealthScore;
  stats: { label: string; value: string; href: string }[];
}

// ─────────── Admin ───────────
export interface AdminOverviewDTO {
  counts: Record<string, number>;
  usersByRole: { role: string; count: number }[];
  listingsByCrop: { crop: string; count: number }[];
  signups: { day: string; count: number }[];
  openReports: number;
  pendingVerifications: number;
  demoRecords: number;
  realRecords: number;
}

export interface AdminUserRow {
  user: UserSummary;
  email?: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  risk: { score: number; reasons: string[] };
}

export interface AdminVerificationRow {
  id: string;
  user: UserSummary;
  kind: string;
  /** For BUSINESS requests: the business being verified (a business badge never becomes a personal badge). */
  targetName?: string;
  note: string;
  documentLabels: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewNote?: string;
}

export interface AdminReportRow {
  id: string;
  reporter: UserSummary;
  targetType: string;
  targetId: string;
  targetPreview: string;
  reason: string;
  details?: string;
  status: "OPEN" | "ACTIONED" | "DISMISSED";
  createdAt: string;
}

export interface AdminContentRow {
  id: string;
  title: string;
  subtitle: string;
  hidden: boolean;
  createdAt: string;
  isDemo: boolean;
  href?: string;
}

export interface VerificationStatusDTO {
  verified: boolean;
  request?: { id: string; kind: string; status: "PENDING" | "APPROVED" | "REJECTED"; note: string; reviewNote?: string; createdAt: string };
}

export type VisibilityValue = Visibility;

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — universal professional layer
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfessionDTO {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  nameHi: string;
  emoji: string;
  suggestedSkills: string[];
  suggestedServices: string[];
  attributes: AttributeField[];
  dashboard: string;
  farmModules: boolean;
  status: "ACTIVE" | "PENDING" | "REJECTED";
  custom: boolean;
}
export interface ProfessionCategoryDTO {
  id: string;
  name: string;
  nameHi: string;
  emoji: string;
  professions: ProfessionDTO[];
}
export interface CatalogDTO {
  categories: ProfessionCategoryDTO[];
  skills: { id: string; name: string; professionIds: string[] }[];
}

/** Only things that can be checked — no star ratings, no made-up scores. */
export interface ReputationDTO {
  completedJobs: number;
  recommendations: number;
  verifiedRecommendations: number;
  verifiedSkills: number;
  certifications: number;
  /** Share of received service requests that got a reply; null until at least 3 requests were received. */
  responseRate: number | null;
  requestsReceived: number;
  experienceYears: number;
  portfolioCount: number;
}

export interface ServiceDTO {
  id: string;
  ownerId: string;
  owner: UserSummary;
  name: string;
  description: string;
  price?: number;
  priceType: ServicePriceType;
  priceLabel: string;
  areas: string[];
  availability: string;
  media: MediaItem[];
  active: boolean;
  isOwn: boolean;
  isDemo: boolean;
  district?: string;
  distanceKm?: number | null;
}

export interface ProfessionalCardDTO {
  user: UserSummary;
  profession: { id: string; name: string; emoji: string; categoryName: string };
  secondaryProfessions: { id: string; name: string; emoji: string }[];
  customProfession?: string;
  experienceYears: number;
  district: string;
  state: string;
  distanceKm?: number | null;
  skills: string[];
  services: { id: string; name: string; priceLabel: string }[];
  availability: { status: AvailabilityStatus; label: string };
  openToWork: boolean;
  reputation: Pick<ReputationDTO, "completedJobs" | "recommendations" | "verifiedSkills">;
  /** Farmer variant only. */
  farmer?: { crops: string[]; produce: { crop: string; quantity: number; unit: string }[] };
  business?: { id: string; name: string };
  saved: boolean;
  isSelf: boolean;
  /** Why this card matched the search — plain language. */
  matchReason?: string;
}

export interface PortfolioEntryDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  skillsUsed: string[];
  media: MediaItem[];
  imageUrl?: string;
  videoUrl?: string;
  meta?: Record<string, string>;
  /** "FARM" when this row is an existing farm-portfolio item surfaced in the universal portfolio. */
  source: "PORTFOLIO" | "FARM";
}

export interface WorkHistoryDTO {
  id: string;
  role: string;
  organization: string;
  kind: WorkKind;
  location: string;
  startDate: string;
  endDate?: string;
  description: string;
  skills: string[];
}

export interface RecommendationDTO {
  id: string;
  author: UserSummary;
  relationship: string;
  body: string;
  skill?: string;
  interactionVerified: boolean;
  createdAt: string;
  isOwn: boolean;
}

export interface BusinessCardDTO {
  id: string;
  owner: UserSummary;
  name: string;
  kind: string;
  about: string;
  services: string[];
  professions: { id: string; name: string; emoji: string }[];
  district: string;
  state: string;
  website?: string;
  verified: boolean;
  openOpportunities: number;
  isOwn: boolean;
  isDemo: boolean;
}

export interface BusinessDetailDTO extends BusinessCardDTO {
  opportunities: WorkOpportunityDTO[];
  team: ProfessionalCardDTO[];
  services_offered: ServiceDTO[];
  reputation: Pick<ReputationDTO, "completedJobs" | "recommendations">;
}

export interface ProfessionalProfileDTO {
  user: UserSummary;
  restricted: boolean;
  profession: ProfessionDTO;
  secondaryProfessions: { id: string; name: string; emoji: string }[];
  customProfession?: string;
  startedYear: number;
  experienceYears: number;
  district: string;
  state: string;
  village?: string;
  serviceRadiusKm?: number;
  serviceAreas: string[];
  about: string;
  languages: string[];
  skills: ProfessionalSkill[];
  attributes: Record<string, string | string[] | number>;
  availability?: { status: AvailabilityStatus; label: string; days: string[]; note?: string; preferences: WorkPreference[]; expectedWage?: { amount: number; unit: string } };
  certifications: Certification[];
  achievements: Achievement[];
  services: ServiceDTO[];
  portfolio: PortfolioEntryDTO[];
  workHistory: WorkHistoryDTO[];
  recommendations: RecommendationDTO[];
  reputation: ReputationDTO;
  business?: BusinessCardDTO;
  /** The full farming extension, present only when the profession is Farmer. */
  farmer?: FarmerProfileDTO | null;
  network: { followers: number; following: number; connections: number };
  viewer: { isSelf: boolean; isFollowing: boolean; connection: ConnectionState; saved: boolean; canRequestService: boolean; canRecommend: boolean; hasRecommended: boolean };
  phone?: string;
  /** Only returned to the owner. */
  privacy?: PrivacySettings;
}

export interface ServiceRequestDTO {
  id: string;
  service: { id: string; name: string; priceLabel: string };
  provider: UserSummary;
  requester: UserSummary;
  date: string;
  location: { village?: string; district: string; state: string };
  description: string;
  status: ServiceRequestStatus;
  conversationId?: string;
  createdAt: string;
  /** Which side the viewer is on. */
  role: "PROVIDER" | "REQUESTER";
  isDemo: boolean;
}

export interface WorkOpportunityDTO {
  id: string;
  poster: UserSummary;
  business?: { id: string; name: string };
  title: string;
  description: string;
  kind: WorkOpportunityKind;
  professions: { id: string; name: string; emoji: string }[];
  skills: string[];
  openings: number;
  district: string;
  state: string;
  village?: string;
  startDate?: string;
  mode: "ONSITE" | "REMOTE";
  pay: { min?: number; max?: number; unit: string };
  payLabel: string;
  duration?: string;
  contactMethod: "IN_APP" | "PHONE";
  status: "OPEN" | "CLOSED" | "FILLED";
  createdAt: string;
  distanceKm?: number | null;
  applicantCount?: number;
  viewer: { isOwn: boolean; applied: boolean; applicationStatus?: string; saved: boolean; matchReasons: string[]; canApply: boolean };
  /** Poster's phone — only when the poster chose PHONE contact AND the viewer's application was accepted (or it's the owner). */
  contactPhone?: string;
  isDemo: boolean;
}

export interface ApplicationDTO {
  id: string;
  opportunity: { id: string; title: string; status: string };
  applicant: ProfessionalCardDTO | null;
  applicantUser: UserSummary;
  note: string;
  status: "APPLIED" | "SHORTLISTED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  conversationId?: string;
  createdAt: string;
}

export interface MapPointDTO {
  id: string;
  type: "PROFESSIONAL" | "SERVICE" | "OPPORTUNITY" | "BUSINESS" | "EVENT";
  title: string;
  subtitle: string;
  emoji: string;
  /** Deliberately approximate (district centroid + offset) — never a private address. */
  lat: number;
  lng: number;
  area: string;
  href: string;
}

export interface MyWorkDTO {
  profileExists: boolean;
  services: ServiceDTO[];
  requestsReceived: ServiceRequestDTO[];
  requestsSent: ServiceRequestDTO[];
  opportunities: WorkOpportunityDTO[];
  applicationsSent: ApplicationDTO[];
  applicationsReceived: ApplicationDTO[];
}

export interface ProfessionalHomeDTO {
  profession: ProfessionDTO | null;
  completeness: { percent: number; missing: { key: string; label: string; href: string }[] };
  nearbyWork: WorkOpportunityDTO[];
  recommendedWork: WorkOpportunityDTO[];
  pendingRequests: ServiceRequestDTO[];
  myServicesCount: number;
  portfolioCount: number;
  reputation: ReputationDTO | null;
  learning: CourseCardDTO[];
  nearbyProfessionals: ProfessionalCardDTO[];
  /** Admin-approved professions people near you work in (discovery). */
  trendingProfessions: { id: string; name: string; emoji: string; count: number }[];
}
