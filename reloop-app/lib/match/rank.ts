import type { Category, Condition, ListingRecord } from "../types";

export type MatchFit = "suitable" | "repair" | "unsuitable";

export type RankedDevice = ListingRecord & { fit: MatchFit };

const categories: Category[] = ["phone", "laptop", "tablet", "monitor", "appliance", "accessory"];
const conditionOrder: Record<Condition, number> = { excellent: 0, good: 1, fair: 2, poor: 3 };

export function requestedCategory(need: string): Category | null {
  const text = need.toLowerCase();
  return categories.find((category) => text.includes(category)) ?? null;
}

export function rankDevices(need: string, listings: ListingRecord[]): RankedDevice[] {
  const category = requestedCategory(need);
  const available = listings.filter((item) => item.donation === "available");
  if (!category || available.length === 0) return [];

  const ranked: RankedDevice[] = available.map((item) => ({
    ...item,
    fit:
      item.category !== category
        ? "unsuitable"
        : item.condition === "fair" || item.condition === "poor"
          ? "repair"
          : "suitable",
  }));

  const suitable = ranked.filter((item) => item.fit === "suitable").sort(byCondition);
  const repair = ranked.filter((item) => item.fit === "repair").sort(byCondition);
  const unsuitable = ranked.filter((item) => item.fit === "unsuitable").sort(byCondition);
  const picked = [...suitable.slice(0, 3)];
  if (repair[0]) picked.push(repair[0]);
  if (unsuitable[0]) picked.push(unsuitable[0]);
  if (picked.length === 0) return unsuitable.slice(0, 3);
  return picked.slice(0, 5);
}

export function localExplanation(device: RankedDevice, category: Category): string {
  if (device.fit === "suitable") {
    return `${device.title} is a ${device.condition} ${device.category}, which matches a ${category} request.`;
  }
  if (device.fit === "repair") {
    return `${device.title} is the requested ${device.category}, but its ${device.condition} condition means it may need repair first.`;
  }
  return `${device.title} is a ${device.category}, so it does not match a ${category} request.`;
}

function byCondition(left: RankedDevice, right: RankedDevice) {
  return conditionOrder[left.condition] - conditionOrder[right.condition];
}
