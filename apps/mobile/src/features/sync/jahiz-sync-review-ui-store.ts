import { create } from 'zustand';

export type JahizSyncReviewKind =
  | 'conflict'
  | 'preserved-review';

export type JahizSyncReviewEntry = {
  tripId: string;
  kind: JahizSyncReviewKind;
  conflictKind:
    | 'create'
    | 'workspace'
    | 'lifecycle';
};

type OwnerReviewMap =
  Record<
    string,
    Record<
      string,
      JahizSyncReviewEntry
    >
  >;

type JahizSyncReviewUiState = {
  byOwner: OwnerReviewMap;
  replaceOwnerReviews: (
    ownerId: string,
    entries:
      JahizSyncReviewEntry[],
  ) => void;
  upsertReview: (
    ownerId: string,
    entry:
      JahizSyncReviewEntry,
  ) => void;
  clearReview: (
    ownerId: string,
    tripId: string,
  ) => void;
  clearOwner: (
    ownerId: string,
  ) => void;
};

export const useJahizSyncReviewUiStore =
  create<JahizSyncReviewUiState>(
    (set) => ({
      byOwner: {},

      replaceOwnerReviews(
        ownerId,
        entries,
      ) {
        set((state) => ({
          byOwner: {
            ...state.byOwner,
            [ownerId]:
              Object.fromEntries(
                entries.map(
                  (entry) => [
                    entry.tripId,
                    entry,
                  ],
                ),
              ),
          },
        }));
      },

      upsertReview(
        ownerId,
        entry,
      ) {
        set((state) => ({
          byOwner: {
            ...state.byOwner,
            [ownerId]: {
              ...state.byOwner[
                ownerId
              ],
              [entry.tripId]:
                entry,
            },
          },
        }));
      },

      clearReview(
        ownerId,
        tripId,
      ) {
        set((state) => {
          const ownerReviews = {
            ...state.byOwner[
              ownerId
            ],
          };

          delete ownerReviews[
            tripId
          ];

          return {
            byOwner: {
              ...state.byOwner,
              [ownerId]:
                ownerReviews,
            },
          };
        });
      },

      clearOwner(ownerId) {
        set((state) => {
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
