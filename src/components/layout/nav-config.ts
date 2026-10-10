import { Bell, Bot, Briefcase, Building2, CalendarDays, MapPin, Wrench, Compass, Film, GraduationCap, Handshake, HeartPulse, Home, Landmark, MessageCircle, PlusCircle, Radio, Settings, ShieldCheck, Sprout, Store, Tractor, User, Users, Wheat, Contact, type LucideIcon } from "lucide-react";
import type { Role } from "@/types/domain";

export interface NavItem {
  href: string;
  key: string; // i18n key
  icon: LucideIcon;
  roles?: Role[];
  /** extra path prefixes that should also mark this item active */
  match?: string[];
}

export const BOTTOM_NAV: NavItem[] = [
  { href: "/home", key: "nav.home", icon: Home },
  { href: "/explore", key: "nav.explore", icon: Compass, match: ["/professionals", "/farmers", "/buyers", "/experts", "/orgs", "/businesses", "/communities", "/events", "/learning", "/map"] },
  { href: "/create", key: "nav.create", icon: PlusCircle },
  { href: "/opportunities", key: "nav.opportunities", icon: Briefcase, match: ["/my-work", "/work"] },
  { href: "/profile", key: "nav.profile", icon: User },
];

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Network",
    items: [
      { href: "/home", key: "nav.home", icon: Home },
      { href: "/explore", key: "nav.explore", icon: Compass },
      { href: "/opportunities", key: "nav.opportunities", icon: Briefcase },
      { href: "/reels", key: "nav.reels", icon: Film },
      { href: "/create", key: "nav.create", icon: PlusCircle },
    ],
  },
  {
    title: "Professionals",
    items: [
      { href: "/professionals", key: "nav.professionals", icon: Contact, match: ["/farmers"] },
      { href: "/my-work", key: "nav.work", icon: Wrench },
      { href: "/businesses", key: "nav.businesses", icon: Building2 },
      { href: "/map", key: "nav.map", icon: MapPin },
      { href: "/communities", key: "nav.communities", icon: Users },
    ],
  },
  {
    title: "My farm",
    items: [
      { href: "/farms", key: "nav.farms", icon: Tractor, roles: ["FARMER"], match: ["/farm"] },
      { href: "/crops", key: "nav.crops", icon: Wheat, roles: ["FARMER"] },
    ],
  },
  {
    title: "Market",
    items: [
      { href: "/market", key: "nav.market", icon: Store },
      { href: "/buyers", key: "nav.buyers", icon: Handshake },
      { href: "/machinery", key: "nav.machinery", icon: Tractor },
    ],
  },
  {
    title: "Learn & support",
    items: [
      { href: "/experts", key: "nav.experts", icon: Sprout },
      { href: "/learning", key: "nav.learning", icon: GraduationCap },
      { href: "/schemes", key: "nav.schemes", icon: Landmark },
      { href: "/health", key: "nav.health", icon: HeartPulse },
      { href: "/events", key: "nav.events", icon: CalendarDays },
      { href: "/live", key: "nav.live", icon: Radio },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/messages", key: "nav.messages", icon: MessageCircle },
      { href: "/notifications", key: "nav.notifications", icon: Bell },
      { href: "/ai-assistant", key: "nav.ai", icon: Bot },
      { href: "/settings", key: "nav.settings", icon: Settings },
      { href: "/admin", key: "nav.admin", icon: ShieldCheck, roles: ["ADMIN"] },
    ],
  },
];

export function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href || pathname.startsWith(item.href + "/")) return true;
  return item.match?.some((m) => pathname === m || pathname.startsWith(m + "/")) ?? false;
}
