import type { Db } from "@/types/domain";
import {
  commentsSeed,
  communitiesSeed,
  communityMembersSeed,
  buildLikes,
  eventsSeed,
  followsSeed,
  liveMessagesSeed,
  liveSessionsSeed,
  postsSeed,
  reelsSeed,
  savedSeed,
  schemesSeed,
  storiesSeed,
} from "./content";
import { farmingSeed, listingsSeed, machinerySeed, requirementsSeed } from "./farming";
import {
  answersSeed,
  conversationsSeed,
  courseModulesSeed,
  courseProgressSeed,
  coursesSeed,
  healthSeed,
  messagesSeed,
  notificationsSeed,
  questionsSeed,
  reportsSeed,
  verificationSeed,
} from "./knowledge";
import { migrateToProfessional } from "../migrate";
import { buildProfessionals } from "./professionals";
import {
  proCommunitiesSeed,
  proCommunityMembersSeed,
  proCourseModulesSeed,
  proCoursesSeed,
  proEventsSeed,
  proFollowsSeed,
  proPostsSeed,
  proReelsSeed,
  proSchemesSeed,
  proStoriesSeed,
} from "./kaamsetu-content";
import { buildAdmin, buildBuyers, buildExperts, buildFarmers, buildFpos, buildOrganizations } from "./people";

export function emptyDb(): Db {
  return {
    users: [],
    farmerProfiles: [],
    buyerProfiles: [],
    expertProfiles: [],
    organizations: [],
    fpos: [],
    farms: [],
    crops: [],
    cropCycles: [],
    expenses: [],
    harvests: [],
    listings: [],
    requirements: [],
    enquiries: [],
    follows: [],
    connections: [],
    posts: [],
    comments: [],
    likes: [],
    saved: [],
    reels: [],
    stories: [],
    communities: [],
    communityMembers: [],
    schemes: [],
    events: [],
    eventRegistrations: [],
    liveSessions: [],
    liveMessages: [],
    courses: [],
    courseModules: [],
    courseProgress: [],
    certificates: [],
    questions: [],
    answers: [],
    notifications: [],
    conversations: [],
    messages: [],
    verificationRequests: [],
    reports: [],
    blocks: [],
    healthResources: [],
    machinery: [],
    aiConversations: [],
    aiMessages: [],
    otpChallenges: [],
    professionCategories: [],
    professions: [],
    skillCatalog: [],
    professionalProfiles: [],
    services: [],
    serviceRequests: [],
    portfolioEntries: [],
    workHistory: [],
    recommendations: [],
    workOpportunities: [],
    applications: [],
    businesses: [],
  };
}

/**
 * Demo seed — every row has isDemo: true. Production deployments run with DEMO_MODE=false
 * and start from emptyDb()/PostgreSQL; nothing here ships as real content.
 */
export function buildDemoDb(): Db {
  const db = emptyDb();
  const farmers = buildFarmers();
  const buyers = buildBuyers();
  const experts = buildExperts();
  const orgs = buildOrganizations();
  const fpos = buildFpos();

  const pros = buildProfessionals();
  db.users = [...farmers.users, ...buyers.users, ...experts.users, ...orgs.users, ...fpos.users, ...pros.users, buildAdmin()];
  db.farmerProfiles = farmers.profiles;
  db.buyerProfiles = buyers.profiles;
  db.expertProfiles = experts.profiles;
  db.organizations = orgs.orgs;
  db.fpos = fpos.fpos;

  Object.assign(db, {
    farms: farmingSeed.farms,
    crops: farmingSeed.crops,
    cropCycles: farmingSeed.cycles,
    expenses: farmingSeed.expenses,
    harvests: farmingSeed.harvests,
  });
  db.listings = listingsSeed;
  db.requirements = requirementsSeed;
  db.machinery = machinerySeed;

  db.posts = [...postsSeed];
  db.comments = commentsSeed;
  db.likes = buildLikes(db.users.filter((u) => u.role !== "ADMIN").map((u) => u.id));
  db.saved = savedSeed;
  db.follows = [...followsSeed];
  db.reels = [...reelsSeed];
  db.stories = [...storiesSeed];
  db.communities = [...communitiesSeed];
  db.communityMembers = [...communityMembersSeed];

  db.schemes = [...schemesSeed];
  db.events = [...eventsSeed];
  db.eventRegistrations = [{ eventId: "e_kisanmela", userId: "u_ramesh", registered: false, reminder: true, isDemo: true }];
  db.liveSessions = liveSessionsSeed;
  db.liveMessages = liveMessagesSeed;

  db.courses = [...coursesSeed];
  db.courseModules = [...courseModulesSeed];
  db.courseProgress = courseProgressSeed;
  db.questions = questionsSeed;
  db.answers = answersSeed;
  db.healthResources = healthSeed;

  db.notifications = notificationsSeed;
  db.conversations = [...conversationsSeed];
  db.messages = [...messagesSeed];
  db.verificationRequests = verificationSeed;
  db.reports = reportsSeed;
  Object.assign(db, {
    professionalProfiles: pros.profiles,
    services: pros.services,
    portfolioEntries: pros.portfolioEntries,
    workHistory: pros.workHistory,
    businesses: pros.businesses,
    recommendations: pros.recommendations,
    serviceRequests: pros.serviceRequests,
    workOpportunities: pros.workOpportunities,
    applications: pros.applications,
  });
  db.conversations.push(...pros.conversations);
  db.messages.push(...pros.messages);

  // KaamSetu demo content beyond farming (profession communities, work posts, trade reels, skill/employment entries, courses).
  db.communities.push(...proCommunitiesSeed);
  db.communityMembers.push(...proCommunityMembersSeed);
  db.posts.push(...proPostsSeed);
  db.reels.push(...proReelsSeed);
  db.stories.push(...proStoriesSeed);
  db.follows.push(...proFollowsSeed);
  db.schemes.push(...proSchemesSeed);
  db.events.push(...proEventsSeed);
  db.courses.push(...proCoursesSeed);
  db.courseModules.push(...proCourseModulesSeed);

  // Seed modules export shared arrays; clone so runtime mutations (and test resets) never leak back into them.
  const out = structuredClone(db);
  // Link farmers/experts/buyers/FPOs to the professional model exactly as an upgrade of an old database would.
  migrateToProfessional(out);
  return out;
}
