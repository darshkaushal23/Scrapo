export type AIStatusIntelligence = {
  statusExplanation: string;
  completedMilestones: string[];
  nextExpectedMilestone: string;
  delayDetected: boolean;
  delayExplanation: string | null;
  recommendedAction: string;
  estimatedCompletion: string | null;
  source: "gemini" | "fallback";
  modelUsed?: string;
  generatedAt: string;
};

export type AIAssistantResponse = {
  reply: string;
  confidence: number;
  sourcesUsed: string[];
  suggestedFollowUps: string[];
  source: "gemini" | "fallback";
};

