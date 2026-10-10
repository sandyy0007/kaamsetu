import { Suspense } from "react";
import { ProfileEditView } from "@/components/features/profile-edit";

export const metadata = { title: "Edit profile" };

export default function ProfileEditPage() {
  return (
    <Suspense>
      <ProfileEditView />
    </Suspense>
  );
}
