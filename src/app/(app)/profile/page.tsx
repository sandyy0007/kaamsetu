"use client";
import { BuyerProfileView, ExpertProfileView, OrgProfileView } from "@/components/features/other-profiles";
import { ProfessionalProfileView } from "@/components/features/professional-profile";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import { EmptyState } from "@/components/ui/state";

export default function MyProfilePage() {
  const { data: me } = useMe();
  if (!me) return <ListSkeleton count={2} />;
  switch (me.role) {
    case "FARMER":
    case "PROFESSIONAL":
      // One universal profile for every profession; farmers get their farm sections as an extension.
      return <ProfessionalProfileView id={me.id} />;
    case "BUYER":
      return <BuyerProfileView id={me.id} />;
    case "EXPERT":
      return <ExpertProfileView id={me.id} />;
    case "GOVERNMENT":
    case "FPO":
      return <OrgProfileView id={me.id} />;
    default:
      return <EmptyState title="Admin account" description="Admins don't have a public profile. Use the Admin panel to manage the platform." action={{ label: "Open admin panel", href: "/admin" }} />;
  }
}
