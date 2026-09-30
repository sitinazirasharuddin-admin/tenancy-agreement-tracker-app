# Test Plan

## v1 Success Scenario
1. Open app (no login) → dashboard loads with 5 seed TAs
2. Verify TA-2024-015 shows "Signed" status + red overdue stamping flag
3. Click "New TA" → enter TA-2024-018, select tenant Acme Solutions, property Menara Sentral, unit 12-03, person in charge "Nadia Hassan" → save
4. TA appears in list with status = preparation
5. Open TA-2024-018 → click "Send for Signing" → status = pending_signing
6. Set signing_date = today → stamping_due_date auto-fills to today + 30 days
7. Click "Mark Signed" → status = signed
8. Add outstanding action "Submit to LHDN" with due_date = stamping_due_date → save
9. Dashboard shows TA-2024-018 with 1 open action
10. Record stamping_submission_date + stamping_fee → set payment_status = paid → status = completed
11. Dashboard shows 0 open actions for TA-2024-018

## Empty State
- Filter to no results → "No tenancy agreements found" + "Create New TA" button
- TA with no outstanding actions → "No outstanding actions" message

## Error State
- Disconnect network → create TA → "Failed to save — check connection" error
- Expiry date before commencement date → form validation error, save blocked

## Loading State
- Page shows skeleton placeholders while fetching TA list

## Partial State
- TA with status = signed but signing_date not set → "Set signing date to calculate stamping due date" prompt
- TA with stamping_submitted but no stamping_fee → fee field highlighted as incomplete