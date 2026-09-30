# Agentic Layer

## Risk Levels

### Low — Auto
- Summarize TA status for dashboard tooltip
- Compute urgency score for outstanding actions
- Suggest next action from current status (e.g. status=signed → "Submit for stamping")
- Draft follow-up reminder text (not sent — just drafted)

### Medium — Light Approval
- Create outstanding action from a suggestion
- Update TA status to next workflow step
- Set stamping_submission_date

### High — Always Approval
- Mark TA as completed
- Reassign person_in_charge
- Change payment_status to "paid"

### Critical — Human-Only
- Delete a TA record
- Delete an outstanding action
- Send follow-up email to tenant (no auto-send in v1)

## Named Tools
| Tool | Risk | Input | Output |
|------|------|-------|--------|
| `compute_urgency` | low | action_id | score |
| `suggest_next_action` | low | ta_id | {action_type, description} |
| `draft_followup` | low | ta_id | email text |
| `create_action` | medium | ta_id, type, desc, due | action record |
| `update_ta_status` | medium | ta_id, new_status | updated TA |
| `delete_ta` | critical | ta_id | — |

## Audit Log Fields
action_type, actor (user_id), target_type, target_id, before_value (JSON), after_value (JSON), timestamp, notes.

## v1 vs Later
**v1:** `compute_urgency` + `suggest_next_action` only (rule-based, no LLM).
**Later:** `draft_followup` with LLM, `create_action` from note parsing, full audit trail on all actions.