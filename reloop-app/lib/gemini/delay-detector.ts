import type { PickupRecord, PickupStatus } from "@/lib/types";

export type DelayCheckResult = {
  delayDetected: boolean;
  delayReason: string | null;
  stage: string;
  daysOverdue: number;
  expectedDeadlineDays: number;
};

export const STAGE_DEADLINES = {
  PICKUP_CONFIRMATION_HOURS: 48,
  INSPECTION_HOURS: 72,
  PROCESSING_HOURS: 120,
};

/**
 * Deterministically checks whether a pickup has exceeded stage deadlines.
 * Gemini may explain detected delays but does not decide official tracking status.
 */
export function detectPickupDelay(
  pickup: PickupRecord,
  now: Date = new Date(),
): DelayCheckResult {
  const nowMs = now.getTime();

  // Find timeline events
  const timeline = pickup.timeline || [];
  const rawCreatedAt = (pickup as unknown as Record<string, unknown>).created_at;
  const requestedEvent = timeline.find((t) => t.status === "requested" && t.at) ||
    (typeof rawCreatedAt === "string" ? { at: rawCreatedAt, label: "Requested", status: "requested" as PickupStatus } : undefined);
  const collectedEvent = timeline.find((t) => t.status === "collected" && t.at);
  const inspectedEvent = timeline.find((t) => t.status === "inspected" && t.at);

  // 1. Scheduled pickup overdue: collectionDate is past and device not collected
  if (pickup.status === "scheduled" && pickup.collectionDate) {
    const scheduledDate = new Date(`${pickup.collectionDate}T23:59:59Z`);
    if (!isNaN(scheduledDate.getTime()) && nowMs > scheduledDate.getTime()) {
      const daysOverdue = Math.max(1, Math.floor((nowMs - scheduledDate.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        delayDetected: true,
        delayReason: `The scheduled collection date (${pickup.collectionDate}) has passed by ${daysOverdue} day(s) without recycler intake confirmation.`,
        stage: "scheduled_pickup_overdue",
        daysOverdue,
        expectedDeadlineDays: 0,
      };
    }
  }

  // 2. Pickup awaiting confirmation: requested > 48h and no recycler assigned/scheduled
  if (pickup.status === "requested") {
    const requestDate = requestedEvent?.at ? new Date(requestedEvent.at) : null;
    if (requestDate && !isNaN(requestDate.getTime())) {
      const hoursWaiting = (nowMs - requestDate.getTime()) / (1000 * 60 * 60);
      if (hoursWaiting > STAGE_DEADLINES.PICKUP_CONFIRMATION_HOURS) {
        const days = Math.floor(hoursWaiting / 24);
        return {
          delayDetected: true,
          delayReason: `Pickup has been awaiting recycler partner assignment for ${days} days (deadline: 2 days).`,
          stage: "pickup_awaiting_confirmation",
          daysOverdue: days - 2,
          expectedDeadlineDays: 2,
        };
      }
    }
  }

  // 3. Recycler inspection overdue: collected > 72h and not yet inspected
  if (pickup.status === "collected") {
    const collectionDate = collectedEvent?.at ? new Date(collectedEvent.at) : null;
    if (collectionDate && !isNaN(collectionDate.getTime())) {
      const hoursSinceIntake = (nowMs - collectionDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceIntake > STAGE_DEADLINES.INSPECTION_HOURS) {
        const days = Math.floor(hoursSinceIntake / 24);
        return {
          delayDetected: true,
          delayReason: `Hardware was received at the recycling hub ${days} days ago and is awaiting technical diagnostic (deadline: 3 days).`,
          stage: "recycler_inspection_overdue",
          daysOverdue: days - 3,
          expectedDeadlineDays: 3,
        };
      }
    }
  }

  // 4. Repair/refurbishment assessment overdue: inspected > 120h and still processing
  if (pickup.status === "processing") {
    const inspectDate = inspectedEvent?.at ? new Date(inspectedEvent.at) : null;
    if (inspectDate && !isNaN(inspectDate.getTime())) {
      const hoursProcessing = (nowMs - inspectDate.getTime()) / (1000 * 60 * 60);
      if (hoursProcessing > STAGE_DEADLINES.PROCESSING_HOURS) {
        const days = Math.floor(hoursProcessing / 24);
        return {
          delayDetected: true,
          delayReason: `Device has been in refurbishment lab for ${days} days without final student matching or parts outcome (deadline: 5 days).`,
          stage: "repair_assessment_overdue",
          daysOverdue: days - 5,
          expectedDeadlineDays: 5,
        };
      }
    }
  }

  return {
    delayDetected: false,
    delayReason: null,
    stage: pickup.status,
    daysOverdue: 0,
    expectedDeadlineDays: 0,
  };
}
