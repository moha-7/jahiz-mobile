# v4.17 Testing Checklist

## Wizard validation

- Route step without departure date blocks Next.
- Route step without return date blocks Next.
- Return date before departure blocks Next.
- Different currencies with missing rate blocks Next.
- Money step without income blocks Next.
- Monthly Salary with amount and no full date is allowed.
- One-time Bonus without date blocks Next.
- Life cost monthly without full date is allowed.
- One-time life cost without date blocks Next.
- Installment without due date blocks Next.
- Trip Costs step without costs blocks Next.

## Drafts

- Open Wizard, add data, close modal → toast says Saved in drafts.
- Draft appears in Drafts tab.
- Resume Draft reopens Wizard with same data.
- Discard Draft removes it.
- Finish creates exactly one active trip and removes the draft.

## Payments

- Due date does not mark payment paid.
- Mark Paid moves item to Paid list.
- Undo returns item to Upcoming.
- Paid card changes after Mark Paid / Undo.

## Currency

- Currency dropdowns show flags and full names.
- Auto from route sets income and trip currency.
- Manual currency selection is still possible.
