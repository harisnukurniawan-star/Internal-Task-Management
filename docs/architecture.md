# Architecture

## Roles
- `supervisor`: manages team assignments, validates realization, evaluates claims.
- `employee`: reads own assignments, submits realization and evidence.

## Workflow
`assigned → in_progress/submitted → approved | revision | rejected`

Task status is synchronized from claim/evaluation changes in PostgreSQL triggers.

## Evidence
Private Supabase Storage bucket `task-evidence`. File metadata lives in `evidence_files`; RLS restricts employees to their own claim folders while supervisors can review all.

## Leaderboard
Weekly leaderboard is derived from task weight and supervisor score. The database refresh function recalculates assignment count, approved count, completion rate, on-time rate, average score, weighted points and rank.

## Security
RLS is enabled on operational tables. Role checks are resolved from `profiles`; employee ownership is resolved through `employees.profile_id`.
