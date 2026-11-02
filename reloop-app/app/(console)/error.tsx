"use client";

import { ErrorState } from "@/components/ui/feedback";

export default function ConsoleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="This screen hit a problem"
      text="This screen failed to render. Retry it. Your account data stays in Supabase."
      onRetry={reset}
    />
  );
}
