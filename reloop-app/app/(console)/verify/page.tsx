import type { Metadata } from "next";
import { VerifyView } from "@/components/verify/verify-view";

export const metadata: Metadata = {
  title: "Scrapo Verify",
};

export default function VerifyPage() {
  return <VerifyView />;
}
