# Country Cost Profiles QA

## Goal

Confirm suggestions are estimated from destination profile data, not from available money.

## Manual cases

### Egypt balanced trip
- Destination: Egypt
- Currency: EGP
- Duration: 7–10 days
- Travelers: 1–2
- Expected: EGP suggestions with Emergency visible.

### Premium vs Balanced
- Same route/dates/travelers
- Switch Balanced to Premium
- Expected: accommodation, food, activities, emergency estimate increase.

### Huge salary safety
- Salary/Savings: very large
- No selected trip costs
- Expected: suggestions do not scale up just because salary is large.

### Different trip currency
- Destination: Egypt
- Trip Currency: EUR
- Expected: suggestions remain in EUR and show safe tier fallback style estimates until richer FX/cost profile conversion is implemented.
