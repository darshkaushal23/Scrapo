"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { statusLabel } from "@/lib/format";
import type { PickupRecord, Role } from "@/lib/types";
import type { AIAssistantResponse, AIStatusIntelligence } from "@/lib/gemini/types";
import { detectPickupDelay } from "@/lib/gemini/delay-detector";
import { subscribeToPickupTracking } from "@/lib/firebase/tracker-service";

const QUICK_QUESTIONS = [
  "Where is my device?",
  "Why is my pickup delayed?",
  "What happens after inspection?",
  "Has my device been inspected?",
  "What is the next step?",
  "Has my device been donated or recycled?",
];

export function AITrackerPanel({
  pickup,
  currentUserRole = "donor",
}: {
  pickup: PickupRecord;
  currentUserRole?: Role;
}) {
  const [liveStatus, setLiveStatus] = useState(pickup.status);
  const [intelligence, setIntelligence] = useState<AIStatusIntelligence | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState("");

  // Assistant Chat State
  const [question, setQuestion] = useState("");
  const [assistantHistory, setAssistantHistory] = useState<Array<{ q: string; a: AIAssistantResponse }>>([]);
  const [askingAssistant, setAskingAssistant] = useState(false);

  const delayCheck = detectPickupDelay(pickup);

  // Realtime Firestore Listener
  useEffect(() => {
    const unsub = subscribeToPickupTracking(pickup.id, (update) => {
      if (update.status) {
        setLiveStatus(update.status);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [pickup.id]);

  // Load Gemini AI Status Intelligence
  useEffect(() => {
    let cancelled = false;

    async function loadAI() {
      setLoadingAI(true);
      setAiError("");

      try {
        const res = await fetch("/api/tracker/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pickupId: pickup.id, pickupData: pickup }),
        });
        if (!res.ok) throw new Error("Could not load AI tracker intelligence.");
        const data = (await res.json()) as AIStatusIntelligence;
        if (!cancelled) {
          setIntelligence(data);
          setLoadingAI(false);
        }
      } catch (err) {
        if (!cancelled) {
          setAiError(err instanceof Error ? err.message : "Error analyzing device status");
          setLoadingAI(false);
        }
      }
    }

    void loadAI();

    return () => {
      cancelled = true;
    };
  }, [pickup]);

  // Handle Assistant Question
  const handleAskAssistant = async (promptQuery?: string) => {
    const query = promptQuery || question;
    if (!query.trim() || askingAssistant) return;

    setAskingAssistant(true);
    try {
      const res = await fetch("/api/tracker/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupId: pickup.id,
          question: query.trim(),
          userRole: currentUserRole,
          pickupData: pickup,
        }),
      });
      const answer = (await res.json()) as AIAssistantResponse;
      setAssistantHistory((prev) => [...prev, { q: query.trim(), a: answer }]);
      setQuestion("");
    } catch {
      // Ignore network error in prototype
    } finally {
      setAskingAssistant(false);
    }
  };

  return (
    <Card className="border-2 border-olive/30 bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-line bg-paper/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-olive text-on-accent text-xs font-bold">
              AI
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-olive">
              Scrapo AI Tracker
            </span>
            <span className="text-muted">·</span>
            <span className="text-xs text-muted">Tracking ID: {pickup.trackingId}</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Live Device Tracking & AI Intelligence
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {delayCheck.delayDetected ? (
            <Pill tone="danger">Delay Detected ({delayCheck.daysOverdue}d overdue)</Pill>
          ) : (
            <Pill tone="lime">On Track</Pill>
          )}
          <Pill tone="paper">{statusLabel[liveStatus]}</Pill>
        </div>
      </div>

      {/* Intelligent Delay Alert Banner */}
      {delayCheck.delayDetected && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-xs leading-5 text-danger">
          <svg className="h-5 w-5 shrink-0 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-bold">Stage Deadline Exceeded: {delayCheck.stage.replace(/_/g, " ")}</p>
            <p className="mt-0.5">{delayCheck.delayReason}</p>
          </div>
        </div>
      )}

      {/* Gemini AI Status Intelligence Box */}
      <div className="mt-5 rounded-2xl border border-line bg-paper/40 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <svg className="h-4 w-4 text-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Gemini AI Status Intelligence
          </h3>
          {intelligence && (
            <span className="text-[10px] text-muted">
              Source: {intelligence.source === "gemini" ? "Google Gemini API" : "Standard Engine"}
              {intelligence.modelUsed ? ` (${intelligence.modelUsed})` : ""}
            </span>
          )}
        </div>

        {loadingAI ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 animate-ping rounded-full bg-olive" />
            Analyzing device tracking data with Gemini AI...
          </div>
        ) : intelligence ? (
          <div className="mt-3 space-y-3 text-xs leading-5">
            <div className="rounded-xl border border-line bg-card p-3">
              <p className="font-semibold text-muted">Current Status Explanation</p>
              <p className="mt-1 text-sm font-medium text-ink">{intelligence.statusExplanation}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-card p-3">
                <p className="font-semibold text-muted">Next Expected Milestone</p>
                <p className="mt-1 font-medium text-ink flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-olive" />
                  {intelligence.nextExpectedMilestone}
                </p>
              </div>

              <div className="rounded-xl border border-line bg-card p-3">
                <p className="font-semibold text-muted">Recommended Next Action</p>
                <p className="mt-1 font-medium text-ink">{intelligence.recommendedAction}</p>
              </div>
            </div>

            {intelligence.estimatedCompletion && (
              <div className="rounded-xl border border-line bg-card p-3 text-[11px] text-muted">
                Estimated Milestone Completion: <strong className="text-ink">{intelligence.estimatedCompletion}</strong>
              </div>
            )}
          </div>
        ) : aiError ? (
          <p className="mt-2 text-xs text-danger">{aiError}</p>
        ) : null}
      </div>

      {/* Feature D: AI Tracking Assistant */}
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <svg className="h-4 w-4 text-olive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Ask AI Tracking Assistant
        </h3>
        <p className="mt-1 text-xs text-muted">
          Ask questions about your device pickup, inspection progress, or delay reasons. Grounded strictly in your records.
        </p>

        {/* Quick Suggestion Pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              className="rounded-full border border-line bg-card px-2.5 py-1 text-[11px] text-muted hover:border-olive/60 hover:text-ink transition-colors"
              onClick={() => handleAskAssistant(q)}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat History */}
        {assistantHistory.length > 0 && (
          <div className="mt-4 space-y-3">
            {assistantHistory.map((item, idx) => (
              <div key={idx} className="space-y-1.5 text-xs">
                <div className="flex justify-end">
                  <div className="rounded-2xl bg-olive px-3.5 py-2 text-on-accent max-w-md">
                    {item.q}
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-line bg-paper/60 px-3.5 py-2.5 text-ink max-w-lg">
                    <p className="leading-5">{item.a.reply}</p>
                    {item.a.sourcesUsed && item.a.sourcesUsed.length > 0 && (
                      <p className="mt-1.5 text-[10px] text-muted border-t border-line/40 pt-1">
                        Sources: {item.a.sourcesUsed.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAssistant();
          }}
        >
          <TextInput
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Has my device been inspected yet?"
            className="text-xs"
          />
          <Button
            type="submit"
            variant="olive"
            size="sm"
            disabled={askingAssistant || !question.trim()}
          >
            {askingAssistant ? "Asking..." : "Ask"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
