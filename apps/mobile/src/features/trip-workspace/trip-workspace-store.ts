import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  createLargeValueSecureStoreAdapter,
} from './jahiz-secure-large-value-storage';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import {
  tripCommitmentItemSchema,
  tripRecurringCommitmentSchema,
  tripCostItemSchema,
  tripMoneyInItemSchema,
  isDuplicateMoneySource,
  selectActiveTripRecord,
  tripPaymentSchema,
  tripProfileSchema,
  tripWorkspaceSchema,
  type CreateTripRouteRequest,
  type TripCommitmentCategoryId,
  type TripCommitmentInstallmentCadence,
  type TripCommitmentItem,
  type TripCommitmentStatus,
  type TripCostCategoryId,
  type TripCostItem,
  type TripCostStatus,
  type TripDates,
  type TripProfile,
  type TripFunds,
  type TripMoneyInAvailability,
  type TripMoneyInCategoryId,
  type TripMoneyInCertainty,
  type TripMoneyInExpectedTiming,
  type TripMoneyInItem,
  type TripMoneyInMonthlyRecurrence,
  type TripPayment,
  type TripPaymentStatus,
  type TripWorkspace,
} from '@jahiz/api-contracts';
import {
  createInitialTripPortfolio,
  hasPersistedTripPortfolioForActiveNamespace,
  useTripPortfolioStore,
} from './trip-portfolio-store';
import {
  isCommitmentInstallmentStatusTransitionAllowed,
} from './commitment-installment-sequence';
import {
  markRecurringOccurrencePaid,
  markRecurringOccurrenceUnpaid,
  setRecurringOccurrenceMoneyReflected,
  updateRecurringCommitmentPlan,
  type RecurringCommitmentPlanPatch,
} from './recurring-commitment-lifecycle';
import {
  beginJahizLocalNamespaceTransition,
  endJahizLocalNamespaceTransition,
  getActiveJahizLocalNamespace,
  jahizLocalNamespaceStorageKey,
  sameJahizLocalNamespace,
  setActiveJahizLocalNamespace,
  TRIP_WORKSPACE_STORAGE_KEY,
  type JahizLocalNamespace,
} from '@/features/local-persistence/jahiz-local-namespace';
import {
  ensureInternalLegacyTripPersistenceReset,
} from '@/features/local-persistence/jahiz-local-persistence-platform';

const nativeWorkspaceSecureStore =
  createLargeValueSecureStoreAdapter(
    SecureStore,
  );

type WebStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

const workspaceStorage: StateStorage = {
  async getItem(name) {
    if (Platform.OS === 'web') {
      const storage = (
        globalThis as typeof globalThis & {
          localStorage?: WebStorage;
        }
      ).localStorage;

      return (
        storage?.getItem(
          jahizLocalNamespaceStorageKey(
            name,
          ),
        ) ?? null
      );
    }

    return nativeWorkspaceSecureStore.getItemAsync(
      jahizLocalNamespaceStorageKey(
        name,
      ),
    );
  },

  async setItem(name, value) {
    if (Platform.OS === 'web') {
      const storage = (
        globalThis as typeof globalThis & {
          localStorage?: WebStorage;
        }
      ).localStorage;

      storage?.setItem(
        jahizLocalNamespaceStorageKey(
          name,
        ),
        value,
      );
      return;
    }

    await nativeWorkspaceSecureStore.setItemAsync(
      jahizLocalNamespaceStorageKey(
        name,
      ),
      value,
    );
  },

  async removeItem(name) {
    if (Platform.OS === 'web') {
      const storage = (
        globalThis as typeof globalThis & {
          localStorage?: WebStorage;
        }
      ).localStorage;

      storage?.removeItem(
        jahizLocalNamespaceStorageKey(
          name,
        ),
      );
      return;
    }

    await nativeWorkspaceSecureStore.deleteItemAsync(
      jahizLocalNamespaceStorageKey(
        name,
      ),
    );
  },
};

function createLocalId(prefix: string): string {
  return [
    prefix,
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join('-');
}

function assertUniqueMoneySource(
  items: TripMoneyInItem[],
  categoryId: TripMoneyInCategoryId,
  title: string,
  excludeId?: string,
): void {
  if (
    isDuplicateMoneySource(
      items,
      {
        categoryId,
        title,
      },
      excludeId,
    )
  ) {
    throw new Error(
      'Duplicate money source.',
    );
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysToIsoDate(
  isoDate: string,
  days: number,
): string {
  const date = new Date(
    `${isoDate}T00:00:00.000Z`,
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonthsToIsoDate(
  isoDate: string,
  months: number,
): string {
  const [year, month, day] =
    isoDate.split('-').map(Number);
  const monthIndex =
    (month ?? 1) - 1 + months;
  const firstOfTarget = new Date(
    Date.UTC(year ?? 1970, monthIndex, 1),
  );
  const targetYear =
    firstOfTarget.getUTCFullYear();
  const targetMonth =
    firstOfTarget.getUTCMonth();
  const lastDay = new Date(
    Date.UTC(
      targetYear,
      targetMonth + 1,
      0,
    ),
  ).getUTCDate();
  const safeDay = Math.min(
    day ?? 1,
    lastDay,
  );

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      safeDay,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

function buildInstallmentAmounts(
  amount: number,
  count: number,
): number[] {
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(
    totalCents / count,
  );
  const remainder =
    totalCents - baseCents * count;

  return Array.from(
    { length: count },
    (_, index) =>
      (baseCents +
        (index < remainder ? 1 : 0)) /
      100,
  );
}

function commitmentDueBeforeTravel(
  dueDate: string,
  departureDate: string | null,
): boolean {
  if (!departureDate) {
    return true;
  }

  return dueDate <= departureDate;
}

export function createInitialTripWorkspace(
  currency = 'AED',
): TripWorkspace {
  const now = nowIso();

  return tripWorkspaceSchema.parse({
    id: createLocalId('trip'),
    version: 1,
    currency,
    route: null,
    dates: {
      departureDate: null,
      returnDate: null,
      flexibility: 'fixed',
    },
    funds: {
      availableNow: null,
      expectedBeforeTravel: 0,
      expectedAfterTravel: 0,
      safetyReserve: 0,
      originCommitments: 0,
    },
    moneyInItems: [],
    moneyInReviewed: false,
    commitments: [],
    commitmentsReviewed: false,
    costsReviewed: false,
    costItems: [],
    payments: [],
    createdAt: now,
    updatedAt: now,
  });
}

const LEGACY_MONEY_IN_IDS = {
  availableNow: 'money-in-legacy-available-now',
  expectedBeforeTravel: 'money-in-legacy-expected-before-travel',
  expectedAfterTravel: 'money-in-legacy-expected-after-travel',
} as const;

const LEGACY_MONEY_IN_ID_SET = new Set<string>(
  Object.values(LEGACY_MONEY_IN_IDS),
);

function buildLegacyMoneyInItems(
  funds: TripFunds,
  currency: string,
  now: string,
): TripMoneyInItem[] {
  const items: TripMoneyInItem[] = [];

  if ((funds.availableNow ?? 0) > 0) {
    items.push(
      tripMoneyInItemSchema.parse({
        id: LEGACY_MONEY_IN_IDS.availableNow,
        title: 'Available money',
        categoryId: 'money-in-savings',
        amount: funds.availableNow,
        currency,
        availability: 'available-now',
        expectedTiming: null,
        expectedDate: null,
        certainty: 'guaranteed',
        includeInReadiness: true,
        notes: 'Migrated from the previous available money amount.',
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  if (funds.expectedBeforeTravel > 0) {
    items.push(
      tripMoneyInItemSchema.parse({
        id: LEGACY_MONEY_IN_IDS.expectedBeforeTravel,
        title: 'Expected before travel',
        categoryId: 'money-in-other',
        amount: funds.expectedBeforeTravel,
        currency,
        availability: 'expected',
        expectedTiming: 'before-travel',
        expectedDate: null,
        certainty: 'non-guaranteed',
        includeInReadiness: true,
        notes: 'Migrated from the previous expected-before-travel amount.',
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  if (funds.expectedAfterTravel > 0) {
    items.push(
      tripMoneyInItemSchema.parse({
        id: LEGACY_MONEY_IN_IDS.expectedAfterTravel,
        title: 'Expected after travel',
        categoryId: 'money-in-other',
        amount: funds.expectedAfterTravel,
        currency,
        availability: 'expected',
        expectedTiming: 'after-travel',
        expectedDate: null,
        certainty: 'non-guaranteed',
        includeInReadiness: false,
        notes: 'Migrated from the previous expected-after-travel amount.',
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  return items;
}

function syncLegacyMoneyInItems(
  items: TripMoneyInItem[],
  funds: TripFunds,
  currency: string,
  now: string,
): TripMoneyInItem[] {
  const retainedItems = items.filter(
    (item) => !LEGACY_MONEY_IN_ID_SET.has(item.id),
  );

  return [
    ...retainedItems,
    ...buildLegacyMoneyInItems(funds, currency, now),
  ];
}

function migrateLegacyWorkspace(
  workspace: TripWorkspace,
): TripWorkspace {
  const now = nowIso();
  let nextWorkspace = workspace;
  let changed = false;
  const legacyCommitmentAmount =
    workspace.funds.originCommitments;

  if (
    workspace.commitments.length === 0 &&
    legacyCommitmentAmount > 0
  ) {
    const legacyCommitment =
      tripCommitmentItemSchema.parse({
        id: createLocalId('commitment'),
        title: 'Home commitments',
        categoryId: 'commitment-other',
        amount: legacyCommitmentAmount,
        currency: workspace.currency,
        dueDate: null,
        dueBeforeTravel: true,
        status: 'unpaid',
        notes:
          'Migrated from the previous combined commitment amount.',
        createdAt: now,
        updatedAt: now,
      });

    nextWorkspace = {
      ...nextWorkspace,
      funds: {
        ...nextWorkspace.funds,
        originCommitments: 0,
      },
      commitments: [legacyCommitment],
      commitmentsReviewed: false,
    };
    changed = true;
  }

  const hasLegacyMoneyIn =
    nextWorkspace.funds.availableNow !== null ||
    nextWorkspace.funds.expectedBeforeTravel > 0 ||
    nextWorkspace.funds.expectedAfterTravel > 0;

  if (
    nextWorkspace.moneyInItems.length === 0 &&
    hasLegacyMoneyIn
  ) {
    nextWorkspace = {
      ...nextWorkspace,
      moneyInItems: buildLegacyMoneyInItems(
        nextWorkspace.funds,
        nextWorkspace.currency,
        now,
      ),
      moneyInReviewed:
        nextWorkspace.funds.availableNow !== null,
    };
    changed = true;
  }

  if (!changed) {
    return workspace;
  }

  return tripWorkspaceSchema.parse({
    ...nextWorkspace,
    updatedAt: now,
  });
}

export type AddMoneyInItemInput = {
  title: string;
  categoryId: TripMoneyInCategoryId;
  amount: number;
  availability: TripMoneyInAvailability;
  expectedTiming?: TripMoneyInExpectedTiming | null;
  expectedDate?: string | null;
  certainty: TripMoneyInCertainty;
  recurrence?: TripMoneyInMonthlyRecurrence | null;
  includeInReadiness: boolean;
  notes?: string | null;
};

export type UpdateMoneyInItemInput = Partial<
  Pick<
    TripMoneyInItem,
    | 'title'
    | 'categoryId'
    | 'amount'
    | 'availability'
    | 'expectedTiming'
    | 'expectedDate'
    | 'certainty'
    | 'includeInReadiness'
    | 'notes'
  >
> & {
  recurrence?:
    | TripMoneyInMonthlyRecurrence
    | null;
};

export type AddCommitmentInput = {
  title: string;
  categoryId: TripCommitmentCategoryId;
  amount: number;
  dueDate?: string | null;
  dueBeforeTravel: boolean;
  status?: TripCommitmentStatus;
  notes?: string | null;
};

export type UpdateCommitmentInput = Partial<
  Pick<
    TripCommitmentItem,
    | 'title'
    | 'categoryId'
    | 'amount'
    | 'dueDate'
    | 'dueBeforeTravel'
    | 'status'
    | 'paidAmountReflectedInMoney'
    | 'notes'
  >
>;

export type CreateCommitmentInstallmentScheduleInput = {
  title: string;
  categoryId: TripCommitmentCategoryId;
  amount: number;
  installmentCount: number;
  cadence: TripCommitmentInstallmentCadence;
  firstDueDate: string;
  notes?: string | null;
};

export type AddRecurringCommitmentInput = {
  title: string;
  categoryId: TripCommitmentCategoryId;
  amount: number;
  firstDueDate: string;

  // null / omitted = ongoing.
  endDate?: string | null;

  notes?: string | null;
};

export type UpdateRecurringCommitmentInput =
  RecurringCommitmentPlanPatch;

export type AddCostItemInput = {
  title: string;
  categoryId: TripCostCategoryId;
  amount: number;
  status?: TripCostStatus;
  dueDate?: string | null;
  notes?: string | null;
};

export type UpdateCostItemInput = Partial<
  Pick<
    TripCostItem,
    'title' | 'categoryId' | 'amount' | 'status' | 'dueDate' | 'notes'
  >
>;

export type RecordPaymentInput = {
  costItemId: string;
  amount: number;
  status: TripPaymentStatus;
  paidAt?: string | null;
  dueDate?: string | null;
  method?: string | null;
  notes?: string | null;
};

export type UpdatePaymentInput = Partial<
  Pick<
    TripPayment,
    'amount' | 'status' | 'paidAt' | 'dueDate' | 'method' | 'notes'
  >
>;

interface TripWorkspaceState {
  workspace: TripWorkspace;
  hasHydrated: boolean;
  markHydrated: () => void;
  setRoute: (route: CreateTripRouteRequest | null) => void;
  setDates: (dates: Partial<TripDates>) => void;
  setTripProfile: (profile: Partial<TripProfile>) => void;
  setFunds: (funds: Partial<TripFunds>) => void;
  setSafetyReserve: (amount: number) => void;
  addMoneyInItem: (input: AddMoneyInItemInput) => string;
  updateMoneyInItem: (
    id: string,
    input: UpdateMoneyInItemInput,
  ) => void;
  removeMoneyInItem: (id: string) => void;
  markMoneyInReviewed: (reviewed?: boolean) => void;
  addCommitment: (input: AddCommitmentInput) => string;
  createCommitmentInstallmentSchedule: (
    input: CreateCommitmentInstallmentScheduleInput,
  ) => string[];
  removeCommitmentInstallmentPlan: (
    planId: string,
  ) => void;
  updateCommitment: (
    id: string,
    input: UpdateCommitmentInput,
  ) => void;
  removeCommitment: (id: string) => void;

  addRecurringCommitment: (
    input: AddRecurringCommitmentInput,
  ) => string;

  updateRecurringCommitment: (
    id: string,
    input: UpdateRecurringCommitmentInput,
  ) => void;

  removeRecurringCommitment: (
    id: string,
  ) => void;

  markRecurringCommitmentOccurrencePaid: (
    id: string,
    dueDate: string,
  ) => void;

  setRecurringCommitmentOccurrenceMoneyReflected: (
    id: string,
    dueDate: string,
    reflected: boolean,
  ) => void;

  markRecurringCommitmentOccurrenceUnpaid: (
    id: string,
    dueDate: string,
  ) => void;

  markCommitmentsReviewed: (reviewed?: boolean) => void;
  markCostsReviewed: (reviewed?: boolean) => void;
  addCostItem: (input: AddCostItemInput) => string;
  updateCostItem: (id: string, input: UpdateCostItemInput) => void;
  removeCostItem: (id: string) => void;
  recordPayment: (input: RecordPaymentInput) => string;
  updatePayment: (id: string, input: UpdatePaymentInput) => void;
  removePayment: (id: string) => void;
  resetWorkspace: () => void;
}

export const useTripWorkspaceStore = create<TripWorkspaceState>()(
  persist(
    (set, get) => ({
      workspace: createInitialTripWorkspace(),
      hasHydrated: false,

      markHydrated: () => {
        set({ hasHydrated: true });
      },

      setRoute: (route) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            route,
            costsReviewed: false,
            updatedAt: nowIso(),
          }),
        }));
      },

      setDates: (dates) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            dates: {
              ...state.workspace.dates,
              ...dates,
            },
            costsReviewed: false,
            updatedAt: nowIso(),
          }),
        }));
      },

      setTripProfile: (profile) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            profile: tripProfileSchema.parse({
              ...state.workspace.profile,
              ...profile,
            }),
            updatedAt: nowIso(),
          }),
        }));
      },
      setFunds: (funds) => {
        set((state) => {
          const now = nowIso();
          const nextFunds = {
            ...state.workspace.funds,
            ...funds,
            originCommitments: 0,
          };
          const moneyInItems = syncLegacyMoneyInItems(
            state.workspace.moneyInItems,
            nextFunds,
            state.workspace.currency,
            now,
          );
          const hasCustomMoneyIn = moneyInItems.some(
            (item) => !LEGACY_MONEY_IN_ID_SET.has(item.id),
          );

          return {
            workspace: tripWorkspaceSchema.parse({
              ...state.workspace,
              funds: nextFunds,
              moneyInItems,
              moneyInReviewed:
                hasCustomMoneyIn ||
                nextFunds.availableNow !== null,
              updatedAt: now,
            }),
          };
        });
      },

      setSafetyReserve: (amount) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            funds: {
              ...state.workspace.funds,
              safetyReserve: amount,
            },
            updatedAt: nowIso(),
          }),
        }));
      },

      addMoneyInItem: (input) => {
        const id = createLocalId('money-in');
        const now = nowIso();
        const workspace = get().workspace;

        assertUniqueMoneySource(
          workspace.moneyInItems,
          input.categoryId,
          input.title,
        );

        const item = tripMoneyInItemSchema.parse({
          id,
          title: input.title,
          categoryId: input.categoryId,
          amount: input.amount,
          currency: workspace.currency,
          availability: input.availability,
          expectedTiming: input.expectedTiming ?? null,
          expectedDate: input.expectedDate ?? null,
          certainty: input.certainty,
          recurrence:
            input.recurrence ??
            undefined,
          includeInReadiness: input.includeInReadiness,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        });

        set({
          workspace: tripWorkspaceSchema.parse({
            ...workspace,
            moneyInItems: [...workspace.moneyInItems, item],
            moneyInReviewed: true,
            updatedAt: now,
          }),
        });

        return id;
      },

      updateMoneyInItem: (id, input) => {
        set((state) => {
          const now = nowIso();
          const currentItem =
            state.workspace.moneyInItems.find(
              (item) =>
                item.id === id,
            );

          if (!currentItem) {
            return state;
          }

          assertUniqueMoneySource(
            state.workspace.moneyInItems,
            input.categoryId ??
              currentItem.categoryId,
            input.title ??
              currentItem.title,
            id,
          );

          const moneyInItems = state.workspace.moneyInItems.map(
            (item) => {
              if (item.id !== id) {
                return item;
              }

              const recurrence =
                input.recurrence === null
                  ? undefined
                  : input.recurrence ??
                    item.recurrence;

              return tripMoneyInItemSchema.parse({
                ...item,
                ...input,
                recurrence,
                currency:
                  state.workspace.currency,
                updatedAt: now,
              });
            },
          );

          return {
            workspace: tripWorkspaceSchema.parse({
              ...state.workspace,
              moneyInItems,
              moneyInReviewed: true,
              updatedAt: now,
            }),
          };
        });
      },

      removeMoneyInItem: (id) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            moneyInItems: state.workspace.moneyInItems.filter(
              (item) => item.id !== id,
            ),
            moneyInReviewed: true,
            updatedAt: nowIso(),
          }),
        }));
      },

      markMoneyInReviewed: (reviewed = true) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            moneyInReviewed: reviewed,
            updatedAt: nowIso(),
          }),
        }));
      },

      addCommitment: (input) => {
        const id = createLocalId('commitment');
        const now = nowIso();
        const workspace = get().workspace;

        const item = tripCommitmentItemSchema.parse({
          id,
          title: input.title,
          categoryId: input.categoryId,
          amount: input.amount,
          currency: workspace.currency,
          dueDate: input.dueDate ?? null,
          dueBeforeTravel: input.dueBeforeTravel,
          status: input.status ?? 'unpaid',
          paidAmountReflectedInMoney: false,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        });

        set({
          workspace: tripWorkspaceSchema.parse({
            ...workspace,
            commitments: [
              ...workspace.commitments,
              item,
            ],
            commitmentsReviewed: true,
            updatedAt: now,
          }),
        });

        return id;
      },

      createCommitmentInstallmentSchedule: (
        input,
      ) => {
        const workspace = get().workspace;

        if (
          !Number.isInteger(
            input.installmentCount,
          ) ||
          input.installmentCount < 2 ||
          input.installmentCount > 24
        ) {
          throw new Error(
            'Commitment installment count must be between 2 and 24.',
          );
        }

        if (
          !Number.isFinite(input.amount) ||
          input.amount <= 0
        ) {
          throw new Error(
            'Commitment installment total must be positive.',
          );
        }

        const now = nowIso();
        const planId = createLocalId(
          'commitment-plan',
        );
        const amounts =
          buildInstallmentAmounts(
            input.amount,
            input.installmentCount,
          );

        const commitments = amounts.map(
          (amount, index) => {
            const dueDate =
              input.cadence === 'biweekly'
                ? addDaysToIsoDate(
                    input.firstDueDate,
                    index * 14,
                  )
                : addMonthsToIsoDate(
                    input.firstDueDate,
                    index,
                  );

            return tripCommitmentItemSchema.parse({
              id: createLocalId('commitment'),
              title: input.title,
              categoryId: input.categoryId,
              amount,
              currency: workspace.currency,
              dueDate,
              dueBeforeTravel:
                commitmentDueBeforeTravel(
                  dueDate,
                  workspace.dates.departureDate,
                ),
              status: 'unpaid',
              notes: input.notes ?? null,
              installmentPlanId: planId,
              installmentCadence: input.cadence,
              installmentNumber: index + 1,
              installmentCount:
                input.installmentCount,
              createdAt: now,
              updatedAt: now,
            });
          },
        );

        set({
          workspace: tripWorkspaceSchema.parse({
            ...workspace,
            commitments: [
              ...workspace.commitments,
              ...commitments,
            ],
            commitmentsReviewed: true,
            updatedAt: now,
          }),
        });

        return commitments.map(
          (item) => item.id,
        );
      },

      removeCommitmentInstallmentPlan: (
        planId,
      ) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            commitments:
              state.workspace.commitments.filter(
                (item) =>
                  item.installmentPlanId !==
                  planId,
              ),
            commitmentsReviewed: true,
            updatedAt: nowIso(),
          }),
        }));
      },

      updateCommitment: (id, input) => {
        set((state) => {
          const now = nowIso();
          const currentItem =
            state.workspace.commitments.find(
              (item) => item.id === id,
            );

          if (!currentItem) {
            return state;
          }

          const requestedStatus =
            input.status ??
            currentItem.status;

          if (
            !isCommitmentInstallmentStatusTransitionAllowed(
              state.workspace.commitments,
              id,
              requestedStatus,
            )
          ) {
            return state;
          }

          const commitments =
            state.workspace.commitments.map(
              (item) => {
                if (item.id !== id) {
                  return item;
                }

                const nextStatus =
                  requestedStatus;

                const paidAmountChanged =
                  input.amount !== undefined &&
                  input.amount !== item.amount;

                const paidAmountReflectedInMoney =
                  nextStatus === 'paid'
                    ? input.paidAmountReflectedInMoney ??
                      (
                        item.status === 'paid' &&
                        !paidAmountChanged
                          ? item.paidAmountReflectedInMoney === true
                          : false
                      )
                    : false;

                return tripCommitmentItemSchema.parse({
                  ...item,
                  ...input,
                  status: nextStatus,
                  paidAmountReflectedInMoney,
                  currency:
                    state.workspace.currency,
                  updatedAt: now,
                });
              },
            );

          return {
            workspace: tripWorkspaceSchema.parse({
              ...state.workspace,
              commitments,
              commitmentsReviewed: true,
              updatedAt: now,
            }),
          };
        });
      },

      removeCommitment: (id) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            commitments:
              state.workspace.commitments.filter(
                (item) => item.id !== id,
              ),
            commitmentsReviewed: true,
            updatedAt: nowIso(),
          }),
        }));
      },

      addRecurringCommitment: (
        input,
      ) => {
        const workspace = get().workspace;
        const now = nowIso();
        const id =
          createLocalId(
            'recurring-commitment',
          );

        const item =
          tripRecurringCommitmentSchema.parse({
            id,
            title: input.title,
            categoryId: input.categoryId,
            amount: input.amount,
            currency: workspace.currency,
            recurrence: {
              cadence: 'monthly',
              firstDueDate:
                input.firstDueDate,
              endDate:
                input.endDate ?? null,
            },
            paidOccurrences: [],
            notes: input.notes ?? null,
            createdAt: now,
            updatedAt: now,
          });

        set({
          workspace:
            tripWorkspaceSchema.parse({
              ...workspace,
              recurringCommitments: [
                ...workspace
                  .recurringCommitments,
                item,
              ],
              commitmentsReviewed: true,
              updatedAt: now,
            }),
        });

        return id;
      },

      updateRecurringCommitment: (
        id,
        input,
      ) => {
        set((state) => {
          const current =
            state.workspace
              .recurringCommitments
              .find(
                (item) =>
                  item.id === id,
              );

          if (!current) {
            return state;
          }

          const now = nowIso();

          const updated =
            updateRecurringCommitmentPlan(
              current,
              input,
              state.workspace.currency,
              now,
            );

          if (!updated) {
            return state;
          }

          return {
            workspace:
              tripWorkspaceSchema.parse({
                ...state.workspace,
                recurringCommitments:
                  state.workspace
                    .recurringCommitments
                    .map(
                      (item) =>
                        item.id === id
                          ? updated
                          : item,
                    ),
                commitmentsReviewed: true,
                updatedAt: now,
              }),
          };
        });
      },

      removeRecurringCommitment: (
        id,
      ) => {
        set((state) => {
          const recurringCommitments =
            state.workspace
              .recurringCommitments
              .filter(
                (item) =>
                  item.id !== id,
              );

          if (
            recurringCommitments.length ===
            state.workspace
              .recurringCommitments.length
          ) {
            return state;
          }

          return {
            workspace:
              tripWorkspaceSchema.parse({
                ...state.workspace,
                recurringCommitments,
                commitmentsReviewed: true,
                updatedAt: nowIso(),
              }),
          };
        });
      },

      markRecurringCommitmentOccurrencePaid: (
        id,
        dueDate,
      ) => {
        set((state) => {
          const current =
            state.workspace
              .recurringCommitments
              .find(
                (item) =>
                  item.id === id,
              );

          if (!current) {
            return state;
          }

          const now = nowIso();

          const updated =
            markRecurringOccurrencePaid(
              current,
              dueDate,
              now,
            );

          if (
            !updated ||
            updated === current
          ) {
            return state;
          }

          return {
            workspace:
              tripWorkspaceSchema.parse({
                ...state.workspace,
                recurringCommitments:
                  state.workspace
                    .recurringCommitments
                    .map(
                      (item) =>
                        item.id === id
                          ? updated
                          : item,
                    ),
                commitmentsReviewed: true,
                updatedAt: now,
              }),
          };
        });
      },

      setRecurringCommitmentOccurrenceMoneyReflected: (
        id,
        dueDate,
        reflected,
      ) => {
        set((state) => {
          const current =
            state.workspace
              .recurringCommitments
              .find(
                (item) =>
                  item.id === id,
              );

          if (!current) {
            return state;
          }

          const now = nowIso();

          const updated =
            setRecurringOccurrenceMoneyReflected(
              current,
              dueDate,
              reflected,
              now,
            );

          if (
            !updated ||
            updated === current
          ) {
            return state;
          }

          return {
            workspace:
              tripWorkspaceSchema.parse({
                ...state.workspace,
                recurringCommitments:
                  state.workspace
                    .recurringCommitments
                    .map(
                      (item) =>
                        item.id === id
                          ? updated
                          : item,
                    ),
                commitmentsReviewed: true,
                updatedAt: now,
              }),
          };
        });
      },

      markRecurringCommitmentOccurrenceUnpaid: (
        id,
        dueDate,
      ) => {
        set((state) => {
          const current =
            state.workspace
              .recurringCommitments
              .find(
                (item) =>
                  item.id === id,
              );

          if (!current) {
            return state;
          }

          const now = nowIso();

          const updated =
            markRecurringOccurrenceUnpaid(
              current,
              dueDate,
              now,
            );

          if (updated === current) {
            return state;
          }

          return {
            workspace:
              tripWorkspaceSchema.parse({
                ...state.workspace,
                recurringCommitments:
                  state.workspace
                    .recurringCommitments
                    .map(
                      (item) =>
                        item.id === id
                          ? updated
                          : item,
                    ),
                commitmentsReviewed: true,
                updatedAt: now,
              }),
          };
        });
      },

      markCommitmentsReviewed: (
        reviewed = true,
      ) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            commitmentsReviewed: reviewed,
            updatedAt: nowIso(),
          }),
        }));
      },

      markCostsReviewed: (
        reviewed = true,
      ) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            costsReviewed: reviewed,
            updatedAt: nowIso(),
          }),
        }));
      },

      addCostItem: (input) => {
        const id = createLocalId('cost');
        const now = nowIso();
        const workspace = get().workspace;

        const item = tripCostItemSchema.parse({
          id,
          title: input.title,
          categoryId: input.categoryId,
          amount: input.amount,
          currency: workspace.currency,
          status: input.status ?? 'estimated',
          dueDate: input.dueDate ?? null,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        });

        set({
          workspace: tripWorkspaceSchema.parse({
            ...workspace,
            costItems: [...workspace.costItems, item],
            costsReviewed: false,
            updatedAt: now,
          }),
        });

        return id;
      },

      updateCostItem: (id, input) => {
        set((state) => {
          const now = nowIso();
          const costItems = state.workspace.costItems.map((item) =>
            item.id === id
              ? tripCostItemSchema.parse({
                  ...item,
                  ...input,
                  currency: state.workspace.currency,
                  updatedAt: now,
                })
              : item,
          );

          return {
            workspace: tripWorkspaceSchema.parse({
              ...state.workspace,
              costItems,
              costsReviewed: false,
              updatedAt: now,
            }),
          };
        });
      },

      removeCostItem: (id) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            costItems: state.workspace.costItems.filter(
              (item) => item.id !== id,
            ),
            payments: state.workspace.payments.filter(
              (payment) => payment.costItemId !== id,
            ),
            costsReviewed: false,
            updatedAt: nowIso(),
          }),
        }));
      },

      recordPayment: (input) => {
        const id = createLocalId('payment');
        const now = nowIso();
        const workspace = get().workspace;

        const payment = tripPaymentSchema.parse({
          id,
          costItemId: input.costItemId,
          amount: input.amount,
          currency: workspace.currency,
          status: input.status,
          paidAt:
            input.status === 'paid'
              ? input.paidAt ?? now
              : input.paidAt ?? null,
          dueDate: input.dueDate ?? null,
          method: input.method ?? null,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        });

        set({
          workspace: tripWorkspaceSchema.parse({
            ...workspace,
            payments: [...workspace.payments, payment],
            updatedAt: now,
          }),
        });

        return id;
      },

      updatePayment: (id, input) => {
        set((state) => {
          const now = nowIso();
          const payments = state.workspace.payments.map((payment) => {
            if (payment.id !== id) return payment;

            const nextStatus = input.status ?? payment.status;
            return tripPaymentSchema.parse({
              ...payment,
              ...input,
              currency: state.workspace.currency,
              paidAt:
                nextStatus === 'paid'
                  ? input.paidAt ?? payment.paidAt ?? now
                  : input.paidAt ?? null,
              updatedAt: now,
            });
          });

          return {
            workspace: tripWorkspaceSchema.parse({
              ...state.workspace,
              payments,
              updatedAt: now,
            }),
          };
        });
      },

      removePayment: (id) => {
        set((state) => ({
          workspace: tripWorkspaceSchema.parse({
            ...state.workspace,
            payments: state.workspace.payments.filter(
              (payment) => payment.id !== id,
            ),
            updatedAt: nowIso(),
          }),
        }));
      },

      resetWorkspace: () => {
        const currency = get().workspace.currency;
        set({
          workspace: createInitialTripWorkspace(currency),
        });
      },
    }),
    {
      name: TRIP_WORKSPACE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => workspaceStorage),
      partialize: (state) => ({
        workspace: state.workspace,
      }),
      merge: (persistedState, currentState) => {
        const candidate = persistedState as
          | Partial<TripWorkspaceState>
          | undefined;
        const parsed = tripWorkspaceSchema.safeParse(
          candidate?.workspace,
        );
        const workspace = parsed.success
          ? migrateLegacyWorkspace(parsed.data)
          : currentState.workspace;

        return {
          ...currentState,
          workspace,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

let portfolioRuntimeSyncing = false;
let portfolioRuntimeReady = false;

function activePortfolioWorkspace():
  TripWorkspace | null {
  return (
    selectActiveTripRecord(
      useTripPortfolioStore.getState()
        .portfolio,
    )?.workspace ?? null
  );
}

function adoptActivePortfolioWorkspace():
  void {
  const workspaceState =
    useTripWorkspaceStore.getState();
  const portfolioState =
    useTripPortfolioStore.getState();

  if (
    !workspaceState.hasHydrated ||
    !portfolioState.hasHydrated
  ) {
    return;
  }

  const activeWorkspace =
    activePortfolioWorkspace();

  if (!activeWorkspace) {
    return;
  }

  if (
    workspaceState.workspace.id ===
      activeWorkspace.id &&
    workspaceState.workspace.updatedAt ===
      activeWorkspace.updatedAt
  ) {
    portfolioRuntimeReady = true;
    return;
  }

  portfolioRuntimeSyncing = true;

  try {
    useTripWorkspaceStore.setState({
      workspace: activeWorkspace,
    });
    portfolioRuntimeReady = true;
  } finally {
    portfolioRuntimeSyncing = false;
  }
}

useTripWorkspaceStore.subscribe(
  (state, previousState) => {
    if (
      portfolioRuntimeSyncing ||
      state.workspace ===
        previousState.workspace
    ) {
      return;
    }

    const portfolioState =
      useTripPortfolioStore.getState();

    if (
      !state.hasHydrated ||
      !portfolioState.hasHydrated
    ) {
      return;
    }

    const activeWorkspace =
      activePortfolioWorkspace();

    if (!activeWorkspace) {
      return;
    }

    if (
      activeWorkspace.id !==
      state.workspace.id
    ) {
      adoptActivePortfolioWorkspace();
      return;
    }

    portfolioRuntimeSyncing = true;

    try {
      portfolioState.replaceTrip(
        state.workspace,
      );
      portfolioRuntimeReady = true;
    } finally {
      portfolioRuntimeSyncing = false;
    }
  },
);

useTripPortfolioStore.subscribe(
  (state, previousState) => {
    if (portfolioRuntimeSyncing) {
      return;
    }

    const workspaceState =
      useTripWorkspaceStore.getState();

    if (
      !state.hasHydrated ||
      !workspaceState.hasHydrated
    ) {
      return;
    }

    const activeChanged =
      state.portfolio.activeTripId !==
      previousState.portfolio.activeTripId;

    const activeWorkspace =
      activePortfolioWorkspace();

    const activeSnapshotChanged =
      Boolean(
        activeWorkspace &&
          (
            activeWorkspace.id !==
              workspaceState.workspace.id ||
            activeWorkspace.updatedAt !==
              workspaceState.workspace
                .updatedAt
          ),
      );

    if (
      activeChanged ||
      activeSnapshotChanged ||
      !portfolioRuntimeReady
    ) {
      adoptActivePortfolioWorkspace();
    }
  },
);

adoptActivePortfolioWorkspace();

let tripNamespaceSwitchTail:
  Promise<void> =
    Promise.resolve();

function waitForInitialTripHydration():
  Promise<void> {
  if (
    useTripWorkspaceStore.getState()
      .hasHydrated &&
    useTripPortfolioStore.getState()
      .hasHydrated
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let unsubscribeWorkspace:
      () => void =
        () => undefined;
    let unsubscribePortfolio:
      () => void =
        () => undefined;

    const check = () => {
      if (
        !useTripWorkspaceStore
          .getState().hasHydrated ||
        !useTripPortfolioStore
          .getState().hasHydrated
      ) {
        return;
      }

      unsubscribeWorkspace();
      unsubscribePortfolio();
      resolve();
    };

    unsubscribeWorkspace =
      useTripWorkspaceStore.subscribe(
        check,
      );
    unsubscribePortfolio =
      useTripPortfolioStore.subscribe(
        check,
      );

    check();
  });
}

async function performTripNamespaceSwitch(
  namespace: JahizLocalNamespace,
): Promise<void> {
  await waitForInitialTripHydration();
  await ensureInternalLegacyTripPersistenceReset();

  if (
    sameJahizLocalNamespace(
      getActiveJahizLocalNamespace(),
      namespace,
    ) &&
    portfolioRuntimeReady
  ) {
    return;
  }

  beginJahizLocalNamespaceTransition();
  portfolioRuntimeSyncing = true;

  /*
   * Editing must pause while the canonical
   * account/local namespace is changing.
   *
   * Otherwise a screen can write to the
   * runtime Workspace while Portfolio sync
   * is intentionally suspended, and the
   * canonical Portfolio snapshot can later
   * replace that unsynchronised edit.
   */
  useTripWorkspaceStore.setState({
    hasHydrated: false,
  });

  try {
    setActiveJahizLocalNamespace(
      namespace,
    );

    const hasPersistedPortfolio =
      await hasPersistedTripPortfolioForActiveNamespace();

    if (hasPersistedPortfolio) {
      await useTripPortfolioStore
        .persist.rehydrate();
    } else {
      useTripPortfolioStore.setState({
        portfolio:
          createInitialTripPortfolio(),
        hasHydrated: true,
      });
    }

    const activeWorkspace =
      activePortfolioWorkspace();

    if (!activeWorkspace) {
      throw new Error(
        'Active trip portfolio workspace is unavailable after namespace switch.',
      );
    }

    // TripPortfolio is the canonical persisted local collection.
    // TripWorkspace remains the active editing/runtime projection and
    // compatibility persistence mirror.
    useTripWorkspaceStore.setState({
      workspace: activeWorkspace,
      hasHydrated: true,
    });

    portfolioRuntimeReady = true;
  } finally {
    portfolioRuntimeSyncing = false;
    endJahizLocalNamespaceTransition();
  }
}

export function switchTripLocalNamespace(
  namespace: JahizLocalNamespace,
): Promise<void> {
  const run =
    tripNamespaceSwitchTail.then(
      () =>
        performTripNamespaceSwitch(
          namespace,
        ),
      () =>
        performTripNamespaceSwitch(
          namespace,
        ),
    );

  tripNamespaceSwitchTail =
    run.then(
      () => undefined,
      () => undefined,
    );

  return run;
}
