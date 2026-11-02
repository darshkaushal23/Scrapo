export type Role = "donor" | "student" | "recycler" | "admin";

export type Category =
  | "phone"
  | "laptop"
  | "tablet"
  | "monitor"
  | "appliance"
  | "accessory";

export type Condition = "excellent" | "good" | "fair" | "poor";

export type WorkingStatus = "working" | "partial" | "not_working";

export type PickupStatus =
  | "requested"
  | "assigned"
  | "scheduled"
  | "collected"
  | "inspected"
  | "processing"
  | "donated"
  | "completed"
  | "rejected"
  | "cancelled"
  | "pickup_failed"
  | "awaiting_rescheduling";

export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

export type VerificationKind = "contact" | "student" | "recycler" | "donor_ownership";

export type VerificationApplication = {
  id: string;
  userId: string;
  userName: string;
  role: Role;
  kind: VerificationKind;
  status: VerificationStatus;
  email?: string;
  phone?: string;
  institution?: string;
  course?: string;
  studentId?: string;
  enrolmentEvidence?: string;
  orgName?: string;
  license?: string;
  ownershipDeclared?: boolean;
  reviewNote?: string;
  reviewerId?: string;
  reviewerName?: string;
  submittedAt: string;
  reviewedAt?: string;
  expiresAt?: string;
};

export type DemoProfile = {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  city: string;
  pointsMonth: number;
  pointsLifetime: number;
  rank: number;
  personalized: boolean;
  verificationStatus?: VerificationStatus;
};

export type DeviceRecord = {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: Category;
  ageYears: number;
  condition: Condition;
  working: WorkingStatus;
  estimatedValue: number;
  points: number;
  status: PickupStatus;
  owner: string;
};

export type TimelineEvent = {
  status: PickupStatus;
  label: string;
  at: string | null;
  note: string;
};

export type PickupRecord = {
  id: string;
  trackingId: string;
  deviceId: string;
  /** Durable donor / owner UID — used for address privacy and certificates. */
  donorId?: string;
  deviceName: string;
  description: string;
  category: Category;
  address: string;
  city: string;
  collectionDate: string | null;
  status: PickupStatus;
  recycler: {
    name: string;
    contact: string;
    phone: string;
    license: string;
  };
  timeline: TimelineEvent[];
  showCertificate: boolean;
  source: "demo" | "session";
};

export type ListingRecord = {
  id: string;
  title: string;
  category: Category;
  condition: Condition;
  studentPrice: number | null;
  donation: "available" | "reserved" | "donated";
  campus: string;
  note: string;
};

export type AssistanceRequest = {
  id: string;
  student: string;
  campus: string;
  need: string;
  category: Category;
  status: "open" | "matched" | "fulfilled";
  note: string;
};

export type FairAccessStatus = "pending" | "flagged" | "approved" | "rejected";

export type FairAccessApplication = {
  id: string;
  studentId: string;
  studentName: string;
  campus: string;
  course: string;
  category: Category;
  educationalNeed: string;
  devicePreference?: string;
  /** Private household token for admin review only — never shown publicly. */
  householdKey?: string;
  acceptsResaleRestriction: boolean;
  status: FairAccessStatus;
  reviewFlags: string[];
  reviewNote?: string;
  reviewerId?: string;
  reviewerName?: string;
  submittedAt: string;
  reviewedAt?: string;
  allocationId?: string;
};

export type FairAccessAllocation = {
  id: string;
  applicationId: string;
  studentId: string;
  studentName: string;
  category: Category;
  deviceLabel: string;
  allocatedAt: string;
  expiresAt: string;
  resaleRestricted: true;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  city: string;
  points: number;
  highlight?: boolean;
};

export type RewardEvent = {
  id: string;
  label: string;
  points: number;
  at: string;
  source: "demo" | "session";
};

export type EcoLevel = {
  name: string;
  from: number;
  summary: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  city: string;
  points: number;
};

export type RecyclerAccount = {
  id: string;
  name: string;
  city: string;
  license: string;
  status: "pending" | "verified" | "needs_info";
  verifiedAt?: string;
  verifiedBy?: string;
};

export type SanitisationStatus = "pending" | "in_progress" | "completed" | "failed";

export type SanitisationVerificationStatus = "pending_review" | "verified" | "rejected";

export type SanitisationRecord = {
  id: string;
  deviceId: string;
  pickupId: string;
  status: SanitisationStatus;
  method: string;
  responsibleRecycler: string;
  technicianId: string;
  technicianName: string;
  completedAt: string | null;
  verificationEvidence: string;
  verificationStatus: SanitisationVerificationStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  notes?: string;
};

export type CustodyStage =
  | "submission"
  | "pickup_confirmation"
  | "handover"
  | "inspection"
  | "sanitisation"
  | "outcome";

export type CustodyEvent = {
  id: string;
  pickupId: string;
  deviceId: string;
  stage: CustodyStage;
  action: string;
  responsibleUserId: string;
  responsibleUserName: string;
  responsibleRole: Role | "technician" | "system";
  responsibleOrg?: string;
  timestamp: string;
  notes: string;
};

export type DonationApproval = {
  id: string;
  device: string;
  student: string;
  campus: string;
  status: "pending" | "approved" | "declined";
};

export type ActivityItem = {
  id: string;
  kind: "pickup" | "reward" | "donation";
  title: string;
  detail: string;
  at: string;
};
