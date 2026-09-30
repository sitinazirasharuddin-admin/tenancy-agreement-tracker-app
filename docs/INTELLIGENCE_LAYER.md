# Intelligence Layer

## Messy Inputs (later)
- Free-text notes pasted into TA record (e.g. "tenant wants to push signing to next week")
- Email content about TA progress
- Status update comments

## Auto-Structure Schema (later)
```json
{
  "ta_reference": "TA-2024-016",
  "extracted_actions": [
    {"action_type": "signing", "description": "Follow up — tenant requested delay", "due_date": "2024-12-15", "priority": "high"}
  ],
  "detected_status_change": "pending_signing",
  "notes": "Tenant asked to reschedule signing to week of Dec 9"
}
```

## Events to Track
TA created, status changed, signing_date set, stamping submitted, payment status changed, action created, action completed.

## Scoring Rules (v1, rule-based)
Urgency score per outstanding action:
- Due date passed: **+50**
- Due within 3 days: **+30**
- Due within 7 days: **+15**
- Priority = high: **+10**
- Priority = medium: **+5**
- TA stamping overdue (stamping_due_date < today, status not stamping_completed/completed): **+25**

Score ≥ 50 = red (critical), 25–49 = amber, < 25 = green.

## What Gets Ranked
- Outstanding actions by urgency score (dashboard "Needs Attention" panel)
- TAs by number of open actions + overdue stamping status

## v1 vs Later
**v1:** Rule-based urgency scoring + overdue highlighting. No AI.
**Later:** Parse free-text notes to auto-create actions, draft follow-up emails, suggest next steps from status patterns.