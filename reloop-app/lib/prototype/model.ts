import type {
  CustodyEvent,
  DemoProfile,
  PickupRecord,
  RewardEvent,
  Role,
  SanitisationRecord,
} from "@/lib/types";

export type InspectionNote = {
  notes: string;
  donationReady: boolean;
  working: "working" | "partial" | "not_working";
};

export type AdminOverlay = {
  suspendedUserIds: string[];
  recyclerStatus: Record<string, "pending" | "verified" | "needs_info">;
  donationStatus: Record<string, "pending" | "approved" | "declined">;
  extraRewards: RewardEvent[];
  winnersPublished: boolean;
};

export type PrototypeState = {
  profile: DemoProfile;
  drafts: PickupRecord[];
  inspections: Record<string, InspectionNote>;
  admin: AdminOverlay;
  sanitisations: Record<string, SanitisationRecord>;
  custodyEvents: Record<string, CustodyEvent[]>;
};

export const emptyAdmin = (): AdminOverlay => ({
  suspendedUserIds: [],
  recyclerStatus: {},
  donationStatus: {},
  extraRewards: [],
  winnersPublished: false,
});

export function homeForRole(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "recycler") return "/recycler";
  if (role === "student") return "/marketplace";
  return "/dashboard";
}
