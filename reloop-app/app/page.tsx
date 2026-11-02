import { Suspense } from "react";
import type { Metadata } from "next";
import { HomePage } from "@/components/marketing/home-page";
import { loadLeaderboard, loadListings } from "@/lib/supabase/records";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Give electronics a second life",
};

export default function Page() {
  return (
    <Suspense fallback={<HomePage listings={[]} board={[]} />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const supabase = await createClient();
  const [listings, board] = await Promise.all([
    loadListings(supabase).catch((error: unknown) => {
      if (error && typeof error === "object" && "digest" in error) throw error;
      return [];
    }),
    loadLeaderboard(supabase).catch((error: unknown) => {
      if (error && typeof error === "object" && "digest" in error) throw error;
      return [];
    }),
  ]);
  return <HomePage listings={listings} board={board} />;
}
