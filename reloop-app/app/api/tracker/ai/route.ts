import { analyzeDeviceWithGemini } from "@/lib/gemini/client";
import { pickups } from "@/lib/mock/data";
import { getCachedAIExplanation, cacheAIExplanationInFirestore } from "@/lib/firebase/tracker-service";
import type { PickupRecord } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pickupId?: unknown; pickupData?: unknown };
    const pickupId = typeof body.pickupId === "string" ? body.pickupId.trim() : "";

    if (!pickupId) {
      return Response.json({ error: "pickupId is required." }, { status: 400 });
    }

    // Find pickup from supplied data or known pickups
    let pickup = pickups.find((p) => p.id === pickupId);
    if (!pickup && body.pickupData && typeof body.pickupData === "object") {
      pickup = body.pickupData as PickupRecord;
    }

    if (!pickup) {
      return Response.json({ error: "Device pickup record not found." }, { status: 404 });
    }

    // 1. Check Firestore AI cache first (Performance & Cost Optimisation)
    const cached = await getCachedAIExplanation(pickup.id, pickup.status);
    if (cached) {
      return Response.json({
        ...cached,
        cached: true,
      });
    }

    // 2. Run Gemini Status Intelligence analysis
    const intelligence = await analyzeDeviceWithGemini(pickup);

    // 3. Cache result in Firestore for future requests
    await cacheAIExplanationInFirestore(pickup.id, pickup.status, intelligence).catch(() => {});

    return Response.json({
      ...intelligence,
      cached: false,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal server error." },
      { status: 500 },
    );
  }
}

