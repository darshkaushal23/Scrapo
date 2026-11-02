import type {
  Category,
  Condition,
  PickupStatus,
  Role,
  WorkingStatus,
} from "@/lib/types";

export const categoryLabel: Record<Category, string> = {
  phone: "Phone",
  laptop: "Laptop",
  tablet: "Tablet",
  monitor: "Monitor",
  appliance: "Appliance",
  accessory: "Accessory",
};

export const conditionLabel: Record<Condition, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "For parts",
};

export const workingLabel: Record<WorkingStatus, string> = {
  working: "Fully working",
  partial: "Partly working",
  not_working: "Not working",
};

export const statusLabel: Record<PickupStatus, string> = {
  requested: "Request Submitted",
  assigned: "Partner Assigned",
  scheduled: "Pickup Scheduled",
  collected: "Device Collected",
  inspected: "Device Inspection",
  processing: "Processing",
  donated: "Donated",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  pickup_failed: "Pickup Failed",
  awaiting_rescheduling: "Awaiting Rescheduling",
};

export const roleLabel: Record<Role, string> = {
  donor: "Donor",
  student: "Student",
  recycler: "Recycler",
  admin: "Admin",
};

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function isCategory(value: string | undefined): value is Category {
  return (
    value === "phone" ||
    value === "laptop" ||
    value === "tablet" ||
    value === "monitor" ||
    value === "appliance" ||
    value === "accessory"
  );
}
