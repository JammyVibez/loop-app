# Profile Design Studio and Marketplace

The Design Studio is available from the owner's profile. It stores a validated profile layout independently of custom CSS and supports desktop and mobile ordering.

## Marketplace

- Creators submit profile layout, scoped CSS, theme tokens, tags and a Loop Coin price.
- New and edited submissions enter moderation; only published designs appear in Explore.
- Purchases are atomic in PostgreSQL. A creator receives 85% of paid sales as Loop Coins; the marketplace retains 15%.
- Purchases are permanent and store a snapshot of the design so the buyer can reapply it later.
- Only verified buyers can submit one review per listing. Published designs are immutable after sales to protect previous purchases.

## Database

Apply `scripts/migrations/006_profile_design_marketplace.sql` after migration 005. It adds profile layout/design CSS fields, listings, purchases, reviews and the atomic purchase function.
