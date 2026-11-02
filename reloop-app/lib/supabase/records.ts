import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityItem,
  AdminUser,
  AssistanceRequest,
  Category,
  Condition,
  CustodyEvent,
  DemoProfile,
  LeaderboardEntry,
  ListingRecord,
  PickupRecord,
  PickupStatus,
  RecyclerAccount,
  RewardEvent,
  SanitisationRecord,
  SanitisationStatus,
  SanitisationVerificationStatus,
  TimelineEvent,
} from "@/lib/types";
import type { Database } from "@/lib/supabase/database.types";
import { statusLabel } from "@/lib/format";

export type Db = SupabaseClient<Database>;

const statuses: PickupStatus[] = [
  "requested",
  "assigned",
  "scheduled",
  "collected",
  "inspected",
  "processing",
  "donated",
  "completed",
  "rejected",
  "cancelled",
  "pickup_failed",
  "awaiting_rescheduling",
];

const mainPath: PickupStatus[] = [
  "requested",
  "assigned",
  "scheduled",
  "collected",
  "inspected",
  "processing",
  "completed",
];

function upcomingAfter(current: PickupStatus): PickupStatus[] {
  if (current === "rejected" || current === "cancelled" || current === "completed") return [];
  if (current === "donated") return ["completed"];
  if (current === "pickup_failed") {
    return ["awaiting_rescheduling", "scheduled", "collected", "inspected", "processing", "completed"];
  }
  if (current === "awaiting_rescheduling") {
    return ["scheduled", "collected", "inspected", "processing", "completed"];
  }
  const index = mainPath.indexOf(current);
  return index === -1 ? [] : mainPath.slice(index + 1);
}

function buildTimeline(
  current: PickupStatus,
  createdAt: string,
  history: { status: string; note: string; created_at: string }[],
): TimelineEvent[] {
  const actual: TimelineEvent[] = history
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((event) => {
      const status = asStatus(event.status);
      return {
        status,
        label: statusLabel[status],
        at: event.created_at,
        note: event.note,
      };
    });
  if (actual.length === 0) {
    actual.push({ status: current, label: statusLabel[current], at: createdAt, note: "" });
  }
  for (const status of upcomingAfter(current)) {
    actual.push({ status, label: statusLabel[status], at: null, note: "" });
  }
  return actual;
}

function asStatus(value: string): PickupStatus {
  return statuses.includes(value as PickupStatus) ? (value as PickupStatus) : "requested";
}

function asCategory(value: string): Category {
  const known: Category[] = ["phone", "laptop", "tablet", "monitor", "appliance", "accessory"];
  return known.includes(value as Category) ? (value as Category) : "accessory";
}

function asCondition(value: string): Condition {
  const known: Condition[] = ["excellent", "good", "fair", "poor"];
  return known.includes(value as Condition) ? (value as Condition) : "good";
}

function asDonation(value: string): ListingRecord["donation"] {
  if (value === "reserved" || value === "donated") return value;
  return "available";
}

export async function loadLeaderboard(supabase: Db, highlightId?: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("id, full_name, city, points_month")
    .order("points_month", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row, index) => ({
    rank: index + 1,
    name: row.full_name,
    city: row.city ?? "",
    points: row.points_month,
    highlight: highlightId ? row.id === highlightId : false,
  }));
}

export async function loadListings(supabase: Db): Promise<ListingRecord[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, device_id, student_price, donation_status, campus, note");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = rows.map((row) => row.device_id);
  const devices = ids.length
    ? await supabase.from("listed_device_cards").select("id, brand, model, category, condition").in("id", ids)
    : { data: [] as { id: string; brand: string; model: string; category: string; condition: string }[] };
  const byId = new Map((devices.data ?? []).map((device) => [device.id, device]));
  return rows.map((row) => {
    const device = byId.get(row.device_id);
    const title = device ? `${device.brand} ${device.model}`.trim() : row.note;
    return {
      id: row.id,
      title: title || "Listed device",
      category: asCategory(device?.category ?? "accessory"),
      condition: asCondition(device?.condition ?? "good"),
      studentPrice: row.student_price,
      donation: asDonation(row.donation_status),
      campus: row.campus,
      note: row.note,
    };
  });
}

export async function loadAssistance(supabase: Db): Promise<AssistanceRequest[]> {
  const { data, error } = await supabase
    .from("assistance_board")
    .select("id, category, need, campus, status");
  if (error) {
    if (/permission|jwt/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    student: "Student",
    campus: row.campus,
    need: row.need,
    category: asCategory(row.category),
    status: row.status === "matched" || row.status === "fulfilled" ? row.status : "open",
    note: row.need,
  }));
}

export async function loadPickups(supabase: Db): Promise<PickupRecord[]> {
  const { data: auth } = await supabase.auth.getUser();
  const { data: viewerProfile } = auth.user
    ? await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  const viewerRole = (viewerProfile?.role as string | undefined) || "";
  const canSeeAllAddresses = viewerRole === "admin" || viewerRole === "recycler";

  const { data, error } = await supabase
    .from("pickups")
    .select("id, tracking_id, device_id, donor_id, recycler_id, address, city, collection_date, status, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    if (/permission|jwt/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  const rows = data ?? [];
  const deviceIds = rows.map((row) => row.device_id);
  const recyclerIds = rows.map((row) => row.recycler_id).filter((id): id is string => Boolean(id));
  const pickupIds = rows.map((row) => row.id);
  const [devices, recyclers, events, addresses] = await Promise.all([
    deviceIds.length
      ? supabase.from("devices").select("id, owner_id, brand, model, category, description").in("id", deviceIds)
      : Promise.resolve({ data: [] as { id: string; owner_id: string; brand: string; model: string; category: string; description: string }[] }),
    recyclerIds.length
      ? supabase.from("recycler_profiles").select("id, org_name, license, city").in("id", recyclerIds)
      : Promise.resolve({ data: [] as { id: string; org_name: string; license: string; city: string }[] }),
    pickupIds.length
      ? supabase.from("request_status_history").select("request_id, status, note, created_at").in("request_id", pickupIds)
      : Promise.resolve({ data: [] as { request_id: string; status: string; note: string; created_at: string }[] }),
    pickupIds.length
      ? supabase.from("pickup_addresses").select("pickup_id, address").in("pickup_id", pickupIds)
      : Promise.resolve({ data: [] as { pickup_id: string; address: string }[], error: null }),
  ]);
  if (addresses.error && !/permission|jwt/i.test(addresses.error.message)) {
    throw new Error(addresses.error.message);
  }
  const deviceById = new Map((devices.data ?? []).map((device) => [device.id, device]));
  const recyclerById = new Map((recyclers.data ?? []).map((recycler) => [recycler.id, recycler]));
  const addressById = new Map((addresses.data ?? []).map((item) => [item.pickup_id, item.address]));
  const eventsByPickup = new Map<string, { status: string; note: string; created_at: string }[]>();
  for (const event of events.data ?? []) {
    const list = eventsByPickup.get(event.request_id) ?? [];
    list.push(event);
    eventsByPickup.set(event.request_id, list);
  }

  return rows.map((row) => {
    const device = deviceById.get(row.device_id);
    const recycler = row.recycler_id ? recyclerById.get(row.recycler_id) : undefined;
    const status = asStatus(row.status);
    const donorId = row.donor_id || device?.owner_id;
    const isOwner = Boolean(auth.user && donorId === auth.user.id);
    const rawAddress = addressById.get(row.id) || row.address || "Shared after a partner accepts";
    // Buyers/students never receive previous-owner street addresses in the API payload.
    const address = isOwner || canSeeAllAddresses ? rawAddress : `Area in ${row.city} · Full street address restricted`;
    return {
      id: row.id,
      trackingId: row.tracking_id,
      deviceId: row.device_id,
      donorId,
      deviceName: device ? `${device.brand} ${device.model}`.trim() : "Device",
      description: device?.description ?? "",
      category: asCategory(device?.category ?? "accessory"),
      address,
      city: row.city,
      collectionDate: row.collection_date,
      status,
      recycler: {
        name: recycler?.org_name ?? "Awaiting assignment",
        contact: recycler?.org_name ?? "Not assigned",
        phone: "—",
        license: recycler?.license ?? "—",
      },
      timeline: buildTimeline(status, row.created_at, eventsByPickup.get(row.id) ?? []),
      showCertificate:
        isOwner && (status === "donated" || status === "completed"),
      source: "session",
    };
  });
}

export async function loadDashboard(supabase: Db) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { donatedCount: 0, estimatedValue: 0, activity: [] as (ActivityItem & { href?: string; certificate?: boolean })[] };
  }
  const [devices, pickups, rewards] = await Promise.all([
    supabase.from("devices").select("id, status, estimated_value, brand, model").eq("owner_id", auth.user.id),
    supabase.from("pickups").select("id, status, city, created_at, device_id").order("created_at", { ascending: false }),
    supabase.from("reward_events").select("id, label, points, created_at").eq("profile_id", auth.user.id).order("created_at", { ascending: false }),
  ]);
  if (devices.error) throw new Error(devices.error.message);
  if (pickups.error) throw new Error(pickups.error.message);
  if (rewards.error) throw new Error(rewards.error.message);
  const donated = (devices.data ?? []).filter((device) => device.status === "donated" || device.status === "completed");
  const names = new Map((devices.data ?? []).map((device) => [device.id, `${device.brand} ${device.model}`.trim()]));
  const activity: (ActivityItem & { href?: string; certificate?: boolean })[] = [
    ...(pickups.data ?? []).map((pickup) => ({
      id: pickup.id,
      kind: "pickup" as const,
      title: names.get(pickup.device_id) || "Pickup",
      detail: `${statusLabel[asStatus(pickup.status)]} · ${pickup.city}`,
      at: pickup.created_at,
      href: `/pickups/${pickup.id}`,
      certificate: names.has(pickup.device_id) && (pickup.status === "donated" || pickup.status === "completed"),
    })),
    ...(rewards.data ?? []).map((reward) => ({
      id: reward.id,
      kind: "reward" as const,
      title: reward.label,
      detail: `${reward.points} points`,
      at: reward.created_at,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return {
    donatedCount: donated.length,
    estimatedValue: donated.reduce((sum, device) => sum + (device.estimated_value ?? 0), 0),
    activity,
  };
}

export async function loadRewards(supabase: Db) {
  const { data: auth } = await supabase.auth.getUser();
  const board = await loadLeaderboard(supabase, auth.user?.id);
  const events = auth.user
    ? await supabase.from("reward_events").select("id, label, points, created_at").eq("profile_id", auth.user.id).order("created_at", { ascending: false })
    : { data: [], error: null };
  if (events.error) throw new Error(events.error.message);
  const history: RewardEvent[] = (events.data ?? []).map((event) => ({
    id: event.id,
    label: event.label,
    points: event.points,
    at: event.created_at,
    source: "session",
  }));
  const { data: results, error } = await supabase
    .from("monthly_results")
    .select("month, rank, points, full_name, city")
    .order("month", { ascending: false })
    .order("rank", { ascending: true });
  if (error && !/permission|jwt/i.test(error.message)) throw new Error(error.message);
  return { board, history, results: results ?? [] };
}

export async function finalizeMonthlyWinners(supabase: Db) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before finalizing winners.");
  const month = new Date();
  const monthDate = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const board = await loadLeaderboard(supabase);
  const top = board.slice(0, 3);
  if (!top.length) throw new Error("There is no contributor to finalize.");
  const { error } = await supabase.from("monthly_winners").insert(
    top.map((entry) => ({
      month: monthDate,
      rank: entry.rank,
      profile_id: auth.user.id,
      points: 0,
      published: true,
    })),
  );
  if (error) throw new Error(error.message);
}

export async function loadProfile(supabase: Db): Promise<DemoProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, city, points_month, points_lifetime")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const board = await loadLeaderboard(supabase, auth.user.id).catch(() => []);
  const rank = board.find((entry) => entry.highlight)?.rank ?? 0;
  return {
    name: data.full_name,
    email: auth.user.email ?? "",
    role: data.role,
    city: data.city ?? "",
    pointsMonth: data.points_month,
    pointsLifetime: data.points_lifetime,
    rank,
    personalized: true,
  };
}

export async function loadAdmin(supabase: Db) {
  const [users, recyclers, listings, board, pickups, rewards, assistance] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role, city, points_lifetime"),
    supabase.from("recycler_profiles").select("id, org_name, city, license, status"),
    supabase.from("listings").select("id, note, campus, donation_status"),
    loadLeaderboard(supabase),
    supabase.from("pickups").select("city"),
    supabase.from("reward_events").select("points"),
    supabase.from("assistance_requests").select("status"),
  ]);
  const failed = [users.error, recyclers.error, listings.error, pickups.error, rewards.error, assistance.error].find(Boolean);
  if (failed) throw new Error(failed.message);
  const byCity = new Map<string, number>();
  for (const row of pickups.data ?? []) {
    const city = row.city || "Unknown";
    byCity.set(city, (byCity.get(city) ?? 0) + 1);
  }
  return {
    users: (users.data ?? []).map((user): AdminUser => ({
      id: user.id,
      name: user.full_name,
      email: "",
      role: user.role,
      city: user.city ?? "",
      points: user.points_lifetime,
    })),
    recyclers: (recyclers.data ?? []).map((recycler): RecyclerAccount => ({
      id: recycler.id,
      name: recycler.org_name,
      city: recycler.city,
      license: recycler.license,
      status: recycler.status === "verified" || recycler.status === "needs_info" ? recycler.status : "pending",
    })),
    donations: (listings.data ?? []).map((listing) => ({
      id: listing.id,
      device: listing.note || "Listing",
      student: "Not matched",
      campus: listing.campus,
      status: listing.donation_status,
    })),
    board,
    impact: {
      devices: (pickups.data ?? []).length,
      students: (assistance.data ?? []).filter((row) => row.status === "fulfilled" || row.status === "matched").length,
      points: (rewards.data ?? []).reduce((sum, row) => sum + row.points, 0),
      byCity: [...byCity.entries()].map(([city, devices]) => ({ city, devices })),
    },
  };
}

export async function createDevicePickup(
  supabase: Db,
  input: {
    category: Category;
    brand: string;
    model: string;
    description: string;
    ageYears: number;
    condition: Condition;
    working: string;
    city: string;
  },
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before requesting a pickup.");
  const { data: device, error } = await supabase
    .from("devices")
    .insert({
      owner_id: auth.user.id,
      category: input.category,
      brand: input.brand,
      model: input.model,
      description: input.description,
      age_years: input.ageYears,
      condition: input.condition,
      working_status: input.working,
      status: "requested",
    })
    .select("id")
    .single();
  if (error || !device) throw new Error(error?.message ?? "The device was not saved.");
  const { data: pickup, error: pickupError } = await supabase
    .from("pickups")
    .insert({
      device_id: device.id,
      donor_id: auth.user.id,
      address: "Address to be confirmed with the donor",
      city: input.city || "Not set",
      status: "requested",
      status_note: "Request submitted",
      recycler_id: null,
    })
    .select("id")
    .single();
  if (pickupError || !pickup) throw new Error(pickupError?.message ?? "The pickup was not saved.");
  return pickup.id;
}

export async function createAssistance(
  supabase: Db,
  input: { need: string; campus: string; category: Category },
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before sending a request.");
  const { error } = await supabase.from("assistance_requests").insert({
    student_id: auth.user.id,
    category: input.category,
    need: input.need,
    campus: input.campus || "Not set",
    status: "open",
  });
  if (error) throw new Error(error.message);
}

export async function saveInspectionEvent(
  supabase: Db,
  pickupId: string,
  input: { notes: string; working: string; donationReady: boolean },
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before saving an inspection.");
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .maybeSingle();
  if (memberError || !member) throw new Error(memberError?.message ?? "This account is not in a partner organization.");
  const status = await supabase
    .from("pickups")
    .update({ status: "inspected", status_note: input.notes })
    .eq("id", pickupId)
    .eq("recycler_id", member.organization_id)
    .select("id");
  if (status.error) throw new Error(status.error.message);
  if (!status.data?.length) throw new Error("Not allowed to change this request status");
  const inspection = await supabase.from("device_inspections").insert({
    pickup_id: pickupId,
    organization_id: member.organization_id,
    inspector_id: auth.user.id,
    notes: input.notes,
    working_status: input.working,
    donation_ready: input.donationReady,
  });
  if (inspection.error) throw new Error(inspection.error.message);
  const processing = await supabase.from("processing_records").insert({
    pickup_id: pickupId,
    organization_id: member.organization_id,
    status: "inspected",
    note: input.notes,
    recorded_by: auth.user.id,
  });
  if (processing.error) throw new Error(processing.error.message);
}

export async function acceptPickup(supabase: Db, pickupId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before accepting a request.");
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .maybeSingle();
  if (memberError || !member) throw new Error(memberError?.message ?? "This account is not in a partner organization.");
  const update = await supabase
    .from("pickups")
    .update({ recycler_id: member.organization_id, status: "assigned", status_note: "Partner assigned" })
    .eq("id", pickupId)
    .is("recycler_id", null)
    .select("id");
  if (update.error) throw new Error(update.error.message);
  if (!update.data?.length) throw new Error("That request is no longer open.");
  const decision = await supabase.from("pickup_decisions").insert({
    pickup_id: pickupId,
    organization_id: member.organization_id,
    decision: "accepted",
    decided_by: auth.user.id,
  });
  if (decision.error) throw new Error(decision.error.message);
}

export async function rejectPickup(supabase: Db, pickupId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before rejecting a request.");
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .maybeSingle();
  if (memberError || !member) throw new Error(memberError?.message ?? "This account is not in a partner organization.");
  const decision = await supabase.from("pickup_decisions").insert({
    pickup_id: pickupId,
    organization_id: member.organization_id,
    decision: "rejected",
    decided_by: auth.user.id,
  });
  if (decision.error) throw new Error(decision.error.message);
}

export async function addOrganizationMember(supabase: Db, profileId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before adding a member.");
  const { data: owner, error: ownerError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .eq("member_role", "owner")
    .maybeSingle();
  if (ownerError || !owner) throw new Error(ownerError?.message ?? "Only an organization owner can add members.");
  const insert = await supabase.from("organization_members").insert({
    organization_id: owner.organization_id,
    profile_id: profileId,
    member_role: "member",
  });
  if (insert.error) throw new Error(insert.error.message);
}

export async function updateCollectionStatus(supabase: Db, pickupId: string, status: string, note: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before updating a collection.");
  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .maybeSingle();
  if (memberError || !member) throw new Error(memberError?.message ?? "This account is not in a partner organization.");
  const update = await supabase
    .from("pickups")
    .update({ status, status_note: note })
    .eq("id", pickupId)
    .eq("recycler_id", member.organization_id)
    .select("id");
  if (update.error) throw new Error(update.error.message);
  if (!update.data?.length) throw new Error("Not allowed to change this request status");
  const processing = await supabase.from("processing_records").insert({
    pickup_id: pickupId,
    organization_id: member.organization_id,
    status,
    note,
    recorded_by: auth.user.id,
  });
  if (processing.error) throw new Error(processing.error.message);
}

export async function cancelPickupRequest(supabase: Db, pickupId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before cancelling a request.");
  const update = await supabase
    .from("pickups")
    .update({ status: "cancelled", status_note: "Cancelled" })
    .eq("id", pickupId)
    .select("id");
  if (update.error) throw new Error(update.error.message);
  if (!update.data?.length) throw new Error("Not allowed to change this request status");
}

export async function loadPartnerMonthlyStats(supabase: Db) {
  const { data, error } = await supabase
    .from("partner_monthly_stats")
    .select("organization_id, month, requests, collected, donated")
    .order("month", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateRecyclerStatus(supabase: Db, id: string, status: RecyclerAccount["status"]) {
  const { error } = await supabase.from("recycler_profiles").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateListingStatus(supabase: Db, id: string, status: "available" | "donated") {
  const { data: listing, error: readError } = await supabase.from("listings").select("device_id").eq("id", id).single();
  if (readError) throw new Error(readError.message);
  const { error } = await supabase.from("listings").update({ donation_status: status }).eq("id", id);
  if (error) throw new Error(error.message);
  if (status !== "donated" || !listing) return;
  const deviceUpdate = await supabase.from("devices").update({ status: "donated" }).eq("id", listing.device_id);
  if (deviceUpdate.error) throw new Error(deviceUpdate.error.message);
  const pickupUpdate = await supabase.from("pickups").update({ status: "donated", status_note: "Donated" }).eq("device_id", listing.device_id);
  if (pickupUpdate.error) throw new Error(pickupUpdate.error.message);
}

export async function loadSanitisationRecord(
  supabase: Db,
  pickupId: string,
): Promise<SanitisationRecord | null> {
  const { data, error } = await supabase
    .from("device_sanitisation_records")
    .select("*")
    .eq("pickup_id", pickupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && !/permission|jwt/i.test(error.message)) {
    throw new Error(error.message);
  }
  if (!data) return null;

  return {
    id: data.id,
    deviceId: data.device_id,
    pickupId: data.pickup_id,
    status: data.status as SanitisationStatus,
    method: data.method,
    responsibleRecycler: "Authorized Recycler Partner",
    technicianId: data.technician_id ?? "",
    technicianName: "Technician",
    completedAt: data.completed_at,
    verificationEvidence: data.verification_evidence,
    verificationStatus: data.verification_status as SanitisationVerificationStatus,
    verifiedBy: data.verified_by,
    verifiedAt: data.verified_at,
    notes: data.notes,
  };
}

export async function submitSanitisationRecord(
  supabase: Db,
  input: {
    deviceId: string;
    pickupId: string;
    status: SanitisationStatus;
    method: string;
    verificationEvidence: string;
    notes?: string;
  },
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before submitting sanitisation records.");

  if (input.status === "completed" && !input.verificationEvidence?.trim()) {
    throw new Error("Verification evidence or log reference is required for completed sanitisation.");
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("device_sanitisation_records")
    .insert({
      device_id: input.deviceId,
      pickup_id: input.pickupId,
      status: input.status,
      method: input.method,
      technician_id: auth.user.id,
      organization_id: member?.organization_id ?? null,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
      verification_evidence: input.verificationEvidence.trim(),
      verification_status: "pending_review",
      notes: input.notes?.trim() || "",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await recordCustodyEvent(supabase, {
    deviceId: input.deviceId,
    pickupId: input.pickupId,
    stage: "sanitisation",
    action: `Data sanitisation updated to ${input.status.replace("_", " ")} via ${input.method}`,
    notes: input.notes?.trim() || `Evidence ref: ${input.verificationEvidence.trim() || "none"}`,
  }).catch(() => {});

  return data.id;
}

export async function verifySanitisationRecord(
  supabase: Db,
  recordId: string,
  status: SanitisationVerificationStatus,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before verifying records.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    throw new Error("Only administrators can verify sanitisation records.");
  }

  const { error } = await supabase
    .from("device_sanitisation_records")
    .update({
      verification_status: status,
      verified_by: auth.user.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", recordId);

  if (error) throw new Error(error.message);
}

export async function loadCustodyHistory(
  supabase: Db,
  pickupId: string,
): Promise<CustodyEvent[]> {
  const { data, error } = await supabase
    .from("device_custody_history")
    .select("*")
    .eq("pickup_id", pickupId)
    .order("happened_at", { ascending: true });

  if (error && !/permission|jwt/i.test(error.message)) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    pickupId: row.pickup_id,
    deviceId: row.device_id,
    stage: row.stage as CustodyEvent["stage"],
    action: row.action,
    responsibleUserId: row.responsible_user_id,
    responsibleUserName: "Authorized Agent",
    responsibleRole: row.responsible_role as CustodyEvent["responsibleRole"],
    responsibleOrg: row.responsible_org ?? undefined,
    timestamp: row.happened_at,
    notes: row.notes,
  }));
}

export async function recordCustodyEvent(
  supabase: Db,
  input: {
    deviceId: string;
    pickupId: string;
    stage: CustodyEvent["stage"];
    action: string;
    notes: string;
  },
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in before recording custody events.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  const role = profile?.role ?? "donor";

  const { error } = await supabase.from("device_custody_history").insert({
    device_id: input.deviceId,
    pickup_id: input.pickupId,
    stage: input.stage,
    action: input.action,
    responsible_user_id: auth.user.id,
    responsible_role: role,
    notes: input.notes,
  });

  if (error) throw new Error(error.message);
}
