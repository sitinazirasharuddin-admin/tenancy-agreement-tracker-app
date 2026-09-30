# Architecture

## Stack
Next.js (App Router) + Supabase (Postgres) + Vercel. Tailwind CSS.

## Now / Next / Later
**Now:** TA CRUD + status workflow + stamping date calc + outstanding actions + dashboard with overdue flags. Seeded demo, no login wall.
**Next:** Filter/search, CSV export, properties/tenants CRUD, five-state polish.
**Later:** Auth + per-user RLS, follow-up email drafting, auto-reminders, audit trail.

## Key Action Flow
1. Staff opens dashboard → sees TA list with status badges + overdue flags
2. Clicks "New TA" → fills reference, selects tenant + property + unit, sets person in charge
3. Status = preparation → update to pending_signing when draft sent
4. Set signing_date → system auto-fills stamping_due_date (+30 days)
5. Create outstanding action "Submit to LHDN" with due date
6. Dashboard highlights overdue stamping in red
7. Record stamping_submission_date + fee → mark payment_status paid → set completed

## Nav Shell
Left sidebar (Dashboard, Agreements, Properties, Tenants, Actions) on desktop; hamburger on mobile. Current section highlighted.

## Layers
1. **Data** (`lib/data/`) — all Supabase calls, stamping date calc
2. **App logic** — status transitions, validation rules
3. **Smart features** (`lib/ai/`) — drafting, scoring (later)

Core runs without AI: status workflow, date math, action tracking, and overdue highlighting are all deterministic.

## Repo Structure
```
src/features/{dashboard,agreements,actions,properties,tenants}/
src/lib/{data,ai}/
tests/ beside each feature
```

## Module Map
| Module | Responsibility | Owns | Build |
|--------|---------------|------|-------|
| lib/data | DB reads/writes, date calc | Supabase queries | 1st |
| agreements | TA lifecycle | TA records, status transitions | 2nd |
| actions | Follow-up tasks | Outstanding actions CRUD | 3rd |
| dashboard | Overview + flags | TA summary, overdue calc | 4th |
| properties | Properties + units | CRUD | 5th |
| tenants | Tenant records | CRUD | 6th |