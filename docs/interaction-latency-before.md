# Interaction Latency Baseline — Before Hardening

Measured by code analysis — actual timings depend on network/Supabase latency.
"UI feedback" = time until visual change. "Backend" = time until persistence confirmed.

| Action | UI Feedback | Requests | Full Refresh? | Bottleneck |
|---|---|---|---|---|
| Create checklist | ~0ms (optimistic) | 1 POST | No | — |
| Complete checklist | ~0ms (optimistic) | 1 PATCH | No | Previously used useOptimistic which reverted on transition settle |
| Delete checklist | ~0ms (optimistic) | 1 DELETE | No | — |
| Edit checklist | ~0ms (inline) | 1 PATCH | No | — |
| Open Prospecção | ~200-400ms | 2 queries (regions + leads bulk) | Server render | Single bulk query vs 80+ count queries (fixed in V8) |
| Open region | ~150-300ms | 3 count queries + 1 data query | Server render | — |
| Tinder next | ~0ms (local state) | 0 | No | Cards pre-loaded in batch |
| Tinder select/discard | ~0ms (optimistic) | 1 POST | No | — |
| Open Pipeline | ~200-400ms | 3 parallel queries | Server render | — |
| Pipeline drag | ~0ms (optimistic) | 1 PATCH | No | Rollback on error |
| Open lead drawer | ~0ms (preview data) | 1 GET (background) | No | Header shows instantly from table data |
| Save note | ~0ms (optimistic) | 1 PATCH | No | Enter-to-save |
| WhatsApp click | ~0ms | 0 | No | External link |
| Instagram click | ~0ms | 0 | No | External link |
| Change stage (drawer) | ~0ms (optimistic) | 1 PATCH | No | Select change, reload drawer data |
| Change stage (StageMover) | ~0ms (optimistic) | 1 PATCH | No | — |
| Register response | ~0ms (optimistic) | 1 POST | No | Shows confirmation state |
| Schedule follow-up | ~0ms (optimistic) | 1 PATCH | No | — |
| Mark meeting | ~0ms (dialog close) | 1 POST | No | — |
| Register proposal | ~0ms (dialog close) | 1 POST | No | — |
| Mark reimbursement received | ~0ms (optimistic) | 1 PATCH | No | — |
| Add to pipeline | ~0ms (optimistic) | 1 PATCH | No | Shows check icon |

## Summary

- All daily-workflow mutations are optimistic (UI updates before server confirms)
- No router.refresh() in hot paths (checklist, pipeline drag, responses, follow-ups, etc.)
- Remaining router.refresh() calls: 26, all in admin/settings/campaign flows
- Lead drawer opens instantly with preview data from table, fetches full data in background
- Pipeline DnD: 5px activation distance, touch 150ms delay, optimistic with rollback

## Known checklist bug (pre-fix)

`useOptimistic` was used for checklist completion, but it reverts state when the React transition settles since the server component props don't update (no revalidation). Fixed by switching to `useState` with manual state management.
