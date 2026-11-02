import { explainMatches } from "@/lib/match/explain";
import { rankDevices, requestedCategory } from "@/lib/match/rank";
import { loadListings } from "@/lib/supabase/records";
import { createClient } from "@/lib/supabase/server";

const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 8;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return Response.json({ error: "Sign in to match a device." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) return Response.json({ error: profileError.message }, { status: 500 });
  if (profile?.role !== "student" && profile?.role !== "admin") {
    return Response.json({ error: "Device matching is for student accounts." }, { status: 403 });
  }

  let need = "";
  try {
    const body = (await request.json()) as { need?: unknown };
    need = typeof body.need === "string" ? body.need.trim() : "";
  } catch {
    return Response.json({ error: "Send a description of the device you need." }, { status: 400 });
  }
  if (need.length < 12 || need.length > 800) {
    return Response.json({ error: "Describe the device in 12 to 800 characters." }, { status: 400 });
  }
  if (!requestedCategory(need)) {
    return Response.json(
      { error: "Name the device: phone, laptop, tablet, monitor, appliance, or accessory." },
      { status: 400 },
    );
  }
  if (limited(auth.user.id)) {
    return Response.json({ error: "Too many match requests. Try again in a few minutes." }, { status: 429 });
  }

  try {
    const listings = await loadListings(supabase);
    const matches = rankDevices(need, listings);
    if (matches.length === 0) {
      return Response.json({ matches: [], ai: "skipped", message: "No available device is listed." });
    }
    const explained = await explainMatches(need, matches);
    return Response.json({
      ai: explained.source,
      matches: matches.map((device) => ({
        id: device.id,
        title: device.title,
        category: device.category,
        condition: device.condition,
        campus: device.campus,
        fit: device.fit,
        explanation: explained.explanations[device.id],
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The match could not be loaded.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function limited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  if (hits.size > 500) hits.clear();
  return false;
}
