import { GoogleGenAI, Type } from "@google/genai";
import type { PickupRecord } from "@/lib/types";
import { detectPickupDelay } from "./delay-detector.ts";
import type { AIAssistantResponse, AIStatusIntelligence } from "./types.ts";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getApiKey());
}

export function createGeminiClient(): GoogleGenAI | null {
  const key = getApiKey();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

/**
 * Builds reliable deterministic fallback when Gemini API is unavailable or unconfigured.
 */
export function buildFallbackStatusIntelligence(
  pickup: PickupRecord,
): AIStatusIntelligence {
  const delayCheck = detectPickupDelay(pickup);
  const doneTimeline = (pickup.timeline || []).filter((t) => t.at);
  const completedMilestones = doneTimeline.map((t) => t.label);
  const recyclerName = pickup.recycler?.name || "Assigned Recycler";

  let nextExpectedMilestone = "Upcoming stage";
  let recommendedAction = "No action required from donor at this time.";
  let statusExplanation = `The device is currently in ${pickup.status} state.`;
  let estimatedCompletion: string | null = null;

  switch (pickup.status) {
    case "requested":
      statusExplanation = "Your donation request has been registered and is pending recycler acceptance.";
      nextExpectedMilestone = "Partner assignment & collection booking";
      recommendedAction = "Ensure the device is powered off and charger/cables are kept together.";
      break;
    case "scheduled":
      statusExplanation = `A collection slot has been reserved with ${recyclerName} for ${pickup.collectionDate || "an upcoming date"}.`;
      nextExpectedMilestone = "Physical device collection at donor location";
      recommendedAction = "Keep the device ready at your Indiranagar pickup address for the scheduled courier.";
      estimatedCompletion = pickup.collectionDate ? `${pickup.collectionDate} (Estimated)` : null;
      break;
    case "collected":
      statusExplanation = `Device has been collected by ${recyclerName} and transferred to the recycling hub.`;
      nextExpectedMilestone = "Technical inspection & hardware diagnostic";
      recommendedAction = "Wait for the intake diagnostic update from the inspection desk.";
      break;
    case "inspected":
      statusExplanation = "Technical diagnostic complete. Condition, battery health, and components have been verified.";
      nextExpectedMilestone = "NIST 800-88 cryptographic data sanitisation";
      recommendedAction = "No action needed. Hardware is in the sanitisation lab queue.";
      break;
    case "processing":
      statusExplanation = "Hardware is undergoing refurbishment, data wipe verification, and fresh software image deployment.";
      nextExpectedMilestone = "Student matching & donation approval";
      recommendedAction = "Refurbishment underway. Will be matched with verified student applications.";
      break;
    case "donated":
      statusExplanation = "Lifecycle complete: This device has been refurbished and successfully handed over to a verified student.";
      nextExpectedMilestone = "Impact certificate issuance";
      recommendedAction = "Download your official Scrapo Donation Certificate.";
      break;
    case "completed":
      statusExplanation = "Processing and circular lifecycle journey concluded.";
      nextExpectedMilestone = "Completed";
      recommendedAction = "Thank you for contributing to electronics circularity!";
      break;
  }

  if (delayCheck.delayDetected) {
    recommendedAction = "Our operations desk has flagged this delay and notified the assigned recycling partner.";
  }

  return {
    statusExplanation,
    completedMilestones,
    nextExpectedMilestone,
    delayDetected: delayCheck.delayDetected,
    delayExplanation: delayCheck.delayReason,
    recommendedAction,
    estimatedCompletion,
    source: "fallback",
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Analyses device tracking records with Gemini AI and returns structured status intelligence.
 */
export async function analyzeDeviceWithGemini(
  pickup: PickupRecord,
): Promise<AIStatusIntelligence> {
  const fallback = buildFallbackStatusIntelligence(pickup);
  const ai = createGeminiClient();

  if (!ai) {
    return fallback;
  }

  const delayCheck = detectPickupDelay(pickup);

  const deviceName = pickup.deviceName || "Registered Device";
  const recyclerName = pickup.recycler?.name || "Assigned Recycling Partner";
  const recyclerLicense = pickup.recycler?.license || "Authorized Partner";

  const prompt = `You are Scrapo AI Tracker, an automated status intelligence engine for donated and recycled electronics.
Analyze this ACTUAL device tracking record:
Device: ${deviceName} (Category: ${pickup.category || "electronics"})
Current Status: ${pickup.status}
Pickup Date: ${pickup.collectionDate || "Not booked"}
Recycler: ${recyclerName} (License: ${recyclerLicense})
Deterministic Delay Detected: ${delayCheck.delayDetected}
Delay Details: ${delayCheck.delayReason || "None"}
Completed Timeline Milestones: ${JSON.stringify(fallback.completedMilestones)}

Rules:
1. Never invent events, dates, or device conditions.
2. Provide a clear statusExplanation explaining what is happening right now with the device.
3. List completedMilestones matching reality.
4. Name the nextExpectedMilestone.
5. If delayDetected is true, explain the delay concisely in delayExplanation; if false, delayExplanation must be null.
6. Provide an actionable recommendedAction for the user.
7. Only provide estimatedCompletion if sufficient information exists; otherwise null.`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            statusExplanation: { type: Type.STRING, description: "Explanation of current status" },
            completedMilestones: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Milestones already reached",
            },
            nextExpectedMilestone: { type: Type.STRING, description: "Next milestone in journey" },
            delayDetected: { type: Type.BOOLEAN, description: "Whether delay is detected" },
            delayExplanation: { type: Type.STRING, nullable: true, description: "Reason for delay or null" },
            recommendedAction: { type: Type.STRING, description: "Advice for donor or technician" },
            estimatedCompletion: { type: Type.STRING, nullable: true, description: "Estimated completion date or null" },
          },
          required: [
            "statusExplanation",
            "completedMilestones",
            "nextExpectedMilestone",
            "delayDetected",
            "recommendedAction",
          ],
        },
      },
    });

    if (!response.text) {
      return fallback;
    }

    const parsed = JSON.parse(response.text) as Partial<AIStatusIntelligence>;

    // Validate response structure
    if (
      typeof parsed.statusExplanation === "string" &&
      Array.isArray(parsed.completedMilestones) &&
      typeof parsed.nextExpectedMilestone === "string" &&
      typeof parsed.delayDetected === "boolean" &&
      typeof parsed.recommendedAction === "string"
    ) {
      return {
        statusExplanation: parsed.statusExplanation,
        completedMilestones: parsed.completedMilestones,
        nextExpectedMilestone: parsed.nextExpectedMilestone,
        delayDetected: parsed.delayDetected || delayCheck.delayDetected,
        delayExplanation: parsed.delayExplanation || delayCheck.delayReason,
        recommendedAction: parsed.recommendedAction,
        estimatedCompletion: parsed.estimatedCompletion ?? fallback.estimatedCompletion,
        source: "gemini",
        modelUsed: DEFAULT_MODEL,
        generatedAt: new Date().toISOString(),
      };
    }

    return fallback;
  } catch (error) {
    console.warn("Gemini AI Tracker fallback activated:", error instanceof Error ? error.message : error);
    return fallback;
  }
}

/**
 * AI Tracking Assistant: Answers authenticated user inquiries grounded strictly on the device record.
 */
export async function askTrackingAssistant(
  pickup: PickupRecord,
  userQuestion: string,
  userRole: string,
): Promise<AIAssistantResponse> {
  const fallback = buildFallbackStatusIntelligence(pickup);
  const q = userQuestion.toLowerCase().trim();

  // Deterministic assistant answers for common intents
  function getDeterministicReply(): AIAssistantResponse {
    const devName = pickup.deviceName || "Device";
    const partnerName = pickup.recycler?.name || "Assigned Recycler";
    const tracking = pickup.trackingId || pickup.id || "TRK";
    let reply = `Your ${devName} is currently ${pickup.status}.`;
    const sources = [`Pickup ${tracking}`, `Assigned to ${partnerName}`];
    const followUps = ["What is the next step?", "Has my device been inspected?", "Why is my pickup delayed?"];

    if (q.includes("where")) {
      if (pickup.status === "scheduled" || pickup.status === "requested") {
        reply = `Your ${devName} is registered for collection in ${pickup.city || "your city"} and scheduled with partner ${partnerName}.`;
      } else if (pickup.status === "collected" || pickup.status === "inspected" || pickup.status === "processing") {
        reply = `Your ${devName} is at the ${partnerName} facility undergoing inspection and processing.`;
      } else if (pickup.status === "donated") {
        reply = `Your ${devName} has completed refurbishment and has been donated to a verified student.`;
      }
    } else if (q.includes("delay")) {
      const delay = detectPickupDelay(pickup);
      if (delay.delayDetected) {
        reply = `Delay flagged: ${delay.delayReason} Our operations team has notified ${partnerName} to expedite this stage.`;
      } else {
        reply = `No delays detected for this pickup. The device is proceeding on schedule within standard stage deadlines.`;
      }
    } else if (q.includes("inspect")) {
      const inspected = (pickup.timeline || []).find((t) => t.status === "inspected" && t.at);
      if (inspected) {
        reply = `Yes, your device was inspected on ${inspected.at}. Technical diagnostic and battery health have been recorded.`;
      } else {
        reply = `Inspection is pending. Once ${partnerName} receives the hardware at their hub, technical inspection will begin.`;
      }
    } else if (q.includes("next step") || q.includes("after inspection") || q.includes("what happens")) {
      reply = `Next milestone: ${fallback.nextExpectedMilestone}. ${fallback.recommendedAction}`;
    } else if (q.includes("donat") || q.includes("recycled") || q.includes("outcome")) {
      if (pickup.status === "donated") {
        reply = `Your device has been donated to a student for educational use.`;
      } else if (pickup.status === "completed") {
        reply = `Your device processing is complete.`;
      } else {
        reply = `Your device is currently in '${pickup.status}' status. Final donation or recycling outcome will be determined following inspection and data sanitisation.`;
      }
    }

    return {
      reply,
      confidence: 0.95,
      sourcesUsed: sources,
      suggestedFollowUps: followUps,
      source: "fallback",
    };
  }

  const ai = createGeminiClient();
  if (!ai) {
    return getDeterministicReply();
  }

  const prompt = `You are the Scrapo AI Tracking Assistant.
Answer the user's question using ONLY the provided device record. Do not invent any outside facts.
User role: ${userRole}
User Question: "${userQuestion}"

Device Record:
- Device: ${pickup.deviceName || "Device"} (${pickup.category || "electronics"})
- Tracking ID: ${pickup.trackingId || pickup.id}
- Current Status: ${pickup.status}
- Recycler: ${pickup.recycler?.name || "Assigned Recycler"}
- Scheduled Collection: ${pickup.collectionDate || "Not booked"}
- Timeline Events: ${JSON.stringify(pickup.timeline || [])}

Respond in valid JSON with:
{
  "reply": "Clear, reassuring, factual answer",
  "confidence": 0.98,
  "sourcesUsed": ["list", "of", "fields", "used"],
  "suggestedFollowUps": ["3 helpful questions the user can ask next"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text) as Partial<AIAssistantResponse>;
      if (parsed.reply && Array.isArray(parsed.suggestedFollowUps)) {
        return {
          reply: parsed.reply,
          confidence: parsed.confidence ?? 0.95,
          sourcesUsed: parsed.sourcesUsed ?? [`Pickup ${pickup.trackingId}`],
          suggestedFollowUps: parsed.suggestedFollowUps,
          source: "gemini",
        };
      }
    }

    return getDeterministicReply();
  } catch {
    return getDeterministicReply();
  }
}
