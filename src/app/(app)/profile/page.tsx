"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BuyerProfileView, ExpertProfileView, OrgProfileView } from "@/components/features/other-profiles";
import { ProfessionalProfileView } from "@/components/features/professional-profile";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import { EmptyState } from "@/components/ui/state";

function ProfileContent() {
  const { data: me, isLoading } = useMe();
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");

  if (queryId) {
    return <ProfessionalProfileView id={queryId} />;
  }

  if (isLoading) return <ListSkeleton count={2} />;

  if (!me) {
    return (
      <EmptyState
        title="Sign in to view your profile"
        description="You are currently signed out or your session has expired. Sign in to view and manage your profile."
        action={{ label: "Sign In", href: "/login" }}
      />
    );
  }

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
      return (
        <EmptyState
          title="Admin account"
          description="Admins don't have a public profile. Use the Admin panel to manage the platform."
          action={{ label: "Open admin panel", href: "/admin" }}
        />
      );
  }
}

export default function MyProfilePage() {
  return (
    <Suspense fallback={<ListSkeleton count={2} />}>
      <ProfileContent />
    </Suspense>
  );
}
