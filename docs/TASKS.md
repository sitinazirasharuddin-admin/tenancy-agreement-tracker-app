# Task Plan

## Sprint 1 — Foundation + Core Engine
- Create Supabase tables + seed data (migration SQL)
- Build `lib/data/` layer: CRUD for TAs, properties, units, tenants, actions
- Stamping due date calc: signing_date + 30 days
- TA create/edit form with all core fields
- TA list page with status badges
- TA detail page with status workflow buttons
- Outstanding actions: create + complete inline on TA detail
- No login wall — seeded demo visible immediately
- **DoD:** Create a new TA, set signing date, see stamping due date auto-calculated, create + complete an outstanding action.

## Sprint 2 — Dashboard + Filtering (v1 Functional Milestone)
- Dashboard: summary counts by status, overdue stamping in red, open actions list
- Filter by status, property, person in charge
- Search by TA reference or tenant name
- Sort by due date / signing date
- Five states: loading skeleton, empty (no TAs), error, partial (missing dates), ready
- **DoD:** Dashboard shows all seed TAs with correct status badges, TA-2024-015 overdue in red, filter works, empty state shows when no results. **The full success scenario is usable end-to-end.**

## Sprint 3 — Polish + Properties/Tenants CRUD
- Properties + units management pages
- Tenants management page
- CSV export of TA list
- Bulk complete outstanding actions
- Notes field editing on TA detail
- **DoD:** Create property + unit + tenant, create a TA referencing them, export to CSV.

## Sprint 4 — Lock It Down
- Supabase Auth (email/password)
- Sign up / login pages
- Replace permissive RLS with owner-scoped policies (auth.uid() = user_id)
- Set user_id on all new rows
- Migrate seed data to a demo user
- **DoD:** New user signs up, sees only their own TAs, cannot read another user's data.

## Gantt
```
S1: Foundation + Core Engine     [████████]
S2: Dashboard + Filtering        [████████] ← v1 functional
S3: Polish + CRUD breadth        [████████]
S4: Lock down (auth + RLS)       [████████]
```