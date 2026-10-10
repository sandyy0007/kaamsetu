import { AuthFrame } from "@/components/layout/auth-frame";
import { RegisterFormView } from "@/components/features/auth-forms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthFrame>
      <RegisterFormView />
    </AuthFrame>
  );
}
