import type { NotificationType, Role, Visibility } from "@/types/domain";

export const APP_NAME = "KaamSetu";
export const TAGLINE = "Your Work. Your Identity. Your Opportunities.";
export const TAGLINE_HI = "काम से पहचान, हुनर से अवसर।";
export const SUBHEADING = "A professional network for skilled, independent and local professionals.";

export const CROPS = [
  "Wheat",
  "Mustard",
  "Bajra",
  "Chickpea",
  "Moong",
  "Guar",
  "Cumin",
  "Barley",
  "Groundnut",
  "Cotton",
  "Onion",
  "Tomato",
  "Vegetables",
  "Fruits",
  "Milk",
] as const;

export const SOIL_TYPES = ["Sandy loam", "Loamy", "Clay loam", "Sandy", "Black cotton", "Alluvial"] as const;
export const IRRIGATION_TYPES = ["Canal", "Tube-well", "Drip", "Sprinkler", "Rain-fed", "Canal + tube-well"] as const;
export const FARMING_METHODS = ["Conventional", "Organic", "Natural farming", "Integrated (IPM)", "Zero-budget"] as const;
export const LANGUAGE_OPTIONS = ["Hindi", "English", "Rajasthani", "Marwari", "Punjabi", "Shekhawati"] as const;

export const ROLE_LABEL: Record<Role, string> = {
  FARMER: "Farmer",
  BUYER: "Buyer",
  EXPERT: "Agriculture Expert",
  GOVERNMENT: "Government / Organisation",
  FPO: "FPO / Cooperative",
  PROFESSIONAL: "Professional",
  ADMIN: "Admin",
};

export const VERIFIED_LABEL: Record<Role, string> = {
  FARMER: "Verified Farmer",
  BUYER: "Verified Buyer",
  EXPERT: "Verified Expert",
  GOVERNMENT: "Verified Organisation",
  FPO: "Verified FPO",
  PROFESSIONAL: "Verified Professional",
  ADMIN: "KaamSetu Admin",
};

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  PRIVATE: "Only me",
  CONNECTIONS: "Connections",
  BUYERS: "Buyers",
  FPO: "My FPO",
  PUBLIC: "Public",
};
export const VISIBILITY_ORDER: Visibility[] = ["PRIVATE", "CONNECTIONS", "BUYERS", "FPO", "PUBLIC"];

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  GOVERNMENT: "Government alerts",
  EVENT: "Event reminders",
  ENQUIRY: "Buyer enquiries",
  EXPERT: "Expert answers",
  COMMUNITY: "Community activity",
  CROP: "Crop reminders",
  LEARNING: "Learning reminders",
  MARKET: "Market updates",
  WEATHER: "Weather alerts",
  FOLLOW: "New followers",
  COMMENT: "Comments",
  LIKE: "Likes",
  AI: "AI recommendations",
  SERVICE: "Service requests",
  WORK: "Work opportunities & applications",
};

export const FEED_TOPICS = [
  "ForYou",
  "Wheat",
  "Mustard",
  "Bajra",
  "Dairy",
  "OrganicFarming",
  "Rajasthan",
  "GovernmentSchemes",
  "Irrigation",
  "Machinery",
] as const;

/** Feed categories that make sense for every profession (matched by post kind / tags on the server). */
export const PRO_FEED_TOPICS = ["ForYou", "Work", "Skills", "Tutorials", "Services", "Safety", "Events", "Announcements"] as const;

export const STAGE_LABEL: Record<string, string> = {
  landPrep: "Land preparation",
  seedSelection: "Seed selection",
  sowing: "Sowing",
  irrigation: "Irrigation",
  fertilization: "Fertilisation",
  pestManagement: "Pest & disease management",
  harvest: "Harvest",
  sale: "Sale",
};

export const EXPENSE_LABEL: Record<string, string> = {
  SEED: "Seed",
  FERTILIZER: "Fertiliser",
  IRRIGATION: "Irrigation",
  LABOUR: "Labour",
  PESTICIDE: "Pesticide",
  MACHINERY: "Machinery",
  OTHER: "Other",
};

export const EMERGENCY_CONTACTS = [
  { name: "National Emergency Number", number: "112", note: "Police, fire, ambulance — nationwide" },
  { name: "Ambulance", number: "108", note: "Available in most states" },
  { name: "Kisan Call Centre", number: "1800-180-1551", note: "Toll-free agriculture advice" },
  { name: "Tele-MANAS (mental health)", number: "14416", note: "Free, 24×7 counselling support" },
];
