import { AuthFrame } from "@/components/layout/auth-frame";
import { LoginForm } from "@/components/features/auth-forms";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFrame>
      <LoginForm />
    </AuthFrame>
  );
}
