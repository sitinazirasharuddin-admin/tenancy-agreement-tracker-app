# Tenancy Agreement Tracker

## Problem
Leasing teams track Tenancy Agreements (TAs) across spreadsheets, emails, and personal notes. Stamping deadlines get missed, follow-ups fall through cracks, and no single view shows which agreements are pending or overdue.

## Target User
Leasing Department staff managing multiple TAs across different properties — responsible for preparation, signing, stamping, payment, and completion follow-up.

## Core Objects
- **Tenancy Agreement** — central record: reference, tenant, property, unit, dates, status, stamping, payment, person in charge
- **Property** — building/portfolio reference
- **Unit** — leasable unit within a property
- **Tenant** — tenant identity and contact
- **Outstanding Action** — follow-up task linked to a TA with due date and priority

## MVP (v1) — Must-Haves
- [ ] Create, view, edit, delete a TA record with all core fields
- [ ] Status workflow: preparation → pending_signing → signed → stamping_submitted → stamping_completed → payment_pending → completed
- [ ] Auto-calculate stamping due date (signing date + 30 days)
- [ ] Outstanding actions: create, complete, filter by TA
- [ ] Dashboard: all TAs with status badges, overdue stamping in red, open action count
- [ ] Filter/search by status, property, person in charge
- [ ] Manage properties, units, tenants (basic CRUD)
- [ ] All screens viewable without login (seeded demo data)

## Non-Goals (v1)
- No mobile app — web only
- No tenant self-service portal
- No online payment gateway
- No digital signing
- No automatic LHDN submission
- No complex accounting
- No AI document drafting

## Success Criteria
A leasing staff member creates TA-2024-018, enters tenant and unit, sets status to pending_signing. They set the signing date — the system auto-fills the stamping due date 30 days out and flags it on the dashboard. They log an outstanding action "Submit to LHDN," then record the stamping submission date + fee, mark payment as paid, and set status to completed. The dashboard reflects zero open actions for that TA. All of this works without a login in the demo.