import { askTrackingAssistant } from "@/lib/gemini/client";
import { pickups } from "@/lib/mock/data";
import type { PickupRecord } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pickupId?: unknown;
      question?: unknown;
      userRole?: unknown;
      pickupData?: unknown;
    };

    const pickupId = typeof body.pickupId === "string" ? body.pickupId.trim() : "";
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const userRole = typeof body.userRole === "string" ? body.userRole.trim() : "donor";

    if (!pickupId || !question) {
      return Response.json(
        { error: "Both pickupId and question are required." },
        { status: 400 },
      );
    }

    if (question.length < 3 || question.length > 500) {
      return Response.json(
        { error: "Question must be between 3 and 500 characters." },
        { status: 400 },
      );
    }

    let pickup = pickups.find((p) => p.id === pickupId);
    if (!pickup && body.pickupData && typeof body.pickupData === "object") {
      pickup = body.pickupData as PickupRecord;
    }

    if (!pickup) {
      return Response.json(
        { error: "Device tracking record not found." },
        { status: 404 },
      );
    }

    const answer = await askTrackingAssistant(pickup, question, userRole);
    return Response.json(answer);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 },
    );
  }
}

