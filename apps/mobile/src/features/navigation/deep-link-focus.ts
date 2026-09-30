export type JahizFocusKey =
  | 'today'
  | 'route'
  | 'dates'
  | 'money'
  | 'ready-money'
  | 'need-to-save'
  | 'commitments'
  | 'costs'
  | 'payments'
  | 'bookings'
  | 'next-commitment'
  | 'next-payment';

export type JahizFocusRoute =
  | '/'
  | '/plan'
  | '/payments'
  | '/trip/create/route'
  | '/trip/create/dates'
  | '/trip/create/funds'
  | '/trip/create/commitments'
  | '/trip/create/costs';

export type JahizFocusTarget = {
  route: JahizFocusRoute;
  focus: JahizFocusKey;
  entityId?: string;
};

export const jahizFocusTargets = {
  readyMoney: {
    route: '/plan',
    focus: 'ready-money',
  },
  needToSave: {
    route: '/plan',
    focus: 'need-to-save',
  },
  bookings: {
    route: '/payments',
    focus: 'bookings',
  },
} as const satisfies Record<
  string,
  JahizFocusTarget
>;

export function buildJahizFocusHref(
  target: JahizFocusTarget,
): string {
  const query = [
    `focus=${encodeURIComponent(
      target.focus,
    )}`,
  ];

  if (target.entityId) {
    query.push(
      `id=${encodeURIComponent(
        target.entityId,
      )}`,
    );
  }

  return `${target.route}?${query.join('&')}`;
}
