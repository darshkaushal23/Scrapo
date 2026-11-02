import type { Category, Condition, WorkingStatus } from "@/lib/types";

const categoryBase: Record<Category, number> = {
  phone: 8000,
  laptop: 22000,
  tablet: 9000,
  monitor: 4500,
  appliance: 2800,
  accessory: 1200,
};

const conditionFactor: Record<Condition, number> = {
  excellent: 0.82,
  good: 0.64,
  fair: 0.4,
  poor: 0.16,
};

const workingFactor: Record<WorkingStatus, number> = {
  working: 1,
  partial: 0.55,
  not_working: 0.22,
};

export type ValuationInput = {
  category: Category;
  ageYears: number;
  condition: Condition;
  working: WorkingStatus;
};

export type Valuation = {
  value: number;
  points: number;
  reuse: "student donation" | "parts recovery";
  lines: { label: string; detail: string }[];
};

function ageFactor(ageYears: number) {
  if (ageYears <= 1) return 1;
  if (ageYears <= 3) return 0.78;
  if (ageYears <= 6) return 0.52;
  return 0.32;
}

/**
 * A transparent on-device estimate for the prototype.
 * It is not an appraisal and it is not stored on a server.
 */
export function estimateDevice(input: ValuationInput): Valuation {
  const age = ageFactor(input.ageYears);
  const value = Math.max(
    200,
    Math.round(
      (categoryBase[input.category] *
        conditionFactor[input.condition] *
        workingFactor[input.working] *
        age) /
        50,
    ) * 50,
  );
  const reuse =
    input.working === "not_working" || input.condition === "poor"
      ? "parts recovery"
      : "student donation";
  const points =
    input.working === "not_working" || input.condition === "poor"
      ? 50
      : input.category === "phone" && input.working === "working"
        ? 100
        : input.category === "laptop" && input.working === "working"
          ? 150
          : input.category === "tablet"
            ? 100
            : input.category === "accessory"
              ? 30
              : 0;

  return {
    value,
    points,
    reuse,
    lines: [
      {
        label: "Category baseline",
        detail: `A ${input.category} starts from a fixed baseline.`,
      },
      {
        label: "Age",
        detail:
          input.ageYears <= 1
            ? "Under a year old keeps the full baseline."
            : `${input.ageYears} years old scales the estimate down.`,
      },
      {
        label: "Condition and power",
        detail: "Working, complete devices stay closer to the baseline.",
      },
      {
        label: "Suggested path",
        detail:
          reuse === "student donation"
            ? "Likely useful to a student after a check and data wipe."
            : "Better routed to parts recovery than to a student.",
      },
    ],
  };
}
