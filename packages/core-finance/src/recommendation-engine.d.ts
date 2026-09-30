export const RECOMMENDATION_ENGINE_VERSION: string;
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low' | 'positive';
export type Recommendation = {
  id: string; key: string; reasonCode: string; family: string; level: string;
  priority: RecommendationPriority; rank: number; title: string; label: string;
  detail: string; actionLabel: string; action: string; cta: string;
  target: Record<string, unknown>; icon: string; confidence: 'low'|'medium'|'high';
  source: string; categoryId: string | null; impact: null | { direction: string; amount: number; currency: string; label: string };
  metric: string | null; dismissible: boolean;
};
export function generateRecommendations(input?: Record<string, unknown>, options?: { limit?: number }): Recommendation[];
export function recommendationSummary(items?: Recommendation[]): { version: string; count: number; critical: number; high: number; topReasonCode: string | null };
