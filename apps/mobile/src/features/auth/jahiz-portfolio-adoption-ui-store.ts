import { create } from 'zustand';

export type JahizPortfolioAdoptionUiEntry = {
  ownerId: string;
  status:
    | 'checking'
    | 'clear'
    | 'offer-local-adoption'
    | 'merge-required';
  candidateTripCount: number;
  accountLocalTripCount: number;
  remoteTripCount: number;
};

type JahizPortfolioAdoptionUiState = {
  byOwner:
    Record<
      string,
      JahizPortfolioAdoptionUiEntry
    >;
  setEntry: (
    entry:
      JahizPortfolioAdoptionUiEntry,
  ) => void;
  markChecking: (
    ownerId: string,
  ) => void;
  markClear: (
    ownerId: string,
  ) => void;
  clearOwner: (
    ownerId: string,
  ) => void;
};

export const useJahizPortfolioAdoptionUiStore =
  create<JahizPortfolioAdoptionUiState>(
    (set) => ({
      byOwner: {},

      setEntry(entry) {
        set((state) => ({
          byOwner: {
            ...state.byOwner,
            [entry.ownerId]:
              entry,
          },
        }));
      },

      markChecking(ownerId) {
        set((state) => ({
          byOwner: {
            ...state.byOwner,
            [ownerId]: {
              ownerId,
              status: 'checking',
              candidateTripCount: 0,
              accountLocalTripCount: 0,
              remoteTripCount: 0,
            },
          },
        }));
      },

      markClear(ownerId) {
        set((state) => ({
          byOwner: {
            ...state.byOwner,
            [ownerId]: {
              ownerId,
              status: 'clear',
              candidateTripCount: 0,
              accountLocalTripCount: 0,
              remoteTripCount: 0,
            },
          },
        }));
      },

      clearOwner(ownerId) {
        set((state) => {
          if (
            !state.byOwner[
              ownerId
            ]
          ) {
            return state;
          }

          const byOwner = {
            ...state.byOwner,
          };

          delete byOwner[
            ownerId
          ];

          return {
            byOwner,
          };
        });
      },
    }),
  );
