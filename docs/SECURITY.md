# Security

## Secret Handling
- Supabase URL + anon key: public, safe for frontend (RLS enforced).
- Service role key: server-only, never in frontend env or client bundles.
- All secrets via Vercel environment variables. No hardcoded keys in code.

## Permission Model
**v1 (demo):** RLS enabled but permissive — all rows readable/writable without login. Suitable for demo with seed data.
**Lock-down sprint:** Replace permissive policies with owner-scoped:
```sql
create policy "<t>_owner_read" on <t>
  for select using (auth.uid() = user_id);
create policy "<t>_owner_write" on <t>
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
Every row carries `user_id` (nullable now, NOT NULL after lock-down).

## Approved-Tools Rule
- Agent uses named tools only (`compute_urgency`, `suggest_next_action`, `draft_followup`, `create_action`, `update_ta_status`)
- Never raw SQL execution or arbitrary API calls from the agent
- Tool permissions follow the risk matrix (low=auto, medium=approve, critical=human)

## Audit Principle
- Every status change, creation, and deletion writes to `audit_logs` with before/after JSON
- Agent actions logged with actor, action_type, target, timestamp
- Logs are append-only — no updates or deletes

## Honesty Note
Per-user isolation (RLS) is NOT active in v1 demo. Do not store real tenant data until the lock-down sprint is complete and auth is verified working.