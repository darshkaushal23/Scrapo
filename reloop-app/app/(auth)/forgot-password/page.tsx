import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Account recovery" };

export default function Page() {
  return <ForgotPasswordForm />;
}
