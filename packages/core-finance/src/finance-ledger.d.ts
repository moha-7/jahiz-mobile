export const FINANCE_LEDGER_VERSION: string;
export function summarizeTrackedOutgoings(rows?: Array<{ type?: string; status?: string; amount?: number }>): {
  version: string;
  paidSoFar: number;
  stillToPay: number;
  totalTrackedOutgoings: number;
  invariantDelta: number;
  occurrenceCount: number;
  paidCount: number;
  upcomingCount: number;
};
export function calculatePlannerAffordability(raw?: {
  startingSavings?: number;
  expectedIncome?: number;
  supportMoney?: number;
  safetyReserve?: number;
  originCommitments?: number;
  tripPlanCost?: number;
}): {
  version: string;
  fundingPool: number;
  readyMoney: number;
  tripPlanCost: number;
  needToSave: number;
  afterTripPosition: number;
  startingSavings: number;
  expectedIncome: number;
  supportMoney: number;
  safetyReserve: number;
  originCommitments: number;
};
