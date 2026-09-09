# Radar V7 — Performance Baseline (BEFORE)

Measured 2026-09-08 before V7 optimizations. Source: codebase audit + live observation.

## Architecture Bottlenecks Found

| Issue | Severity | Pages affected |
|-------|----------|----------------|
| Double `getUser()` (middleware + layout) | P0 | ALL |
| Prospecção full-table rollup (ALL leads) | P0 | /prospeccao |
| Zero query limits on Resultados/Pipeline | P1 | /resultados, /pipeline |
| 52× `router.refresh()` after mutations | P0 | ALL (9 re-queries per click) |
| Sequential waterfall Hoje (6→7 queries) | P1 | /hoje |
| Sequential waterfall Pipeline (3→4 queries) | P1 | /pipeline |
| No `display: swap` on fonts (5 weights) | P1 | ALL (FOIT on first load) |
| No client-side router cache | P1 | ALL (every back/forward re-fetches) |
| Admin client re-created per call | P2 | API routes |
| Zero Suspense/streaming | P2 | ALL |

## Measured Values (Estimates)

| Metric | /hoje | /pipeline | /prospeccao | /resultados |
|--------|-------|-----------|-------------|-------------|
| Supabase queries | 7+layout(4)=11 | 4+layout(4)=8 | 40+layout(4)=44 | 3+layout(4)=7 |
| Sequential waterfalls | 1 (messages) | 1 (messages) | 1 (sub-tab) | 0 |
| router.refresh per mutation | 3-4 (checklist, fila) | 2 (add lead) | 0 | 3 |
| Font files loaded | 7 (5 jakarta + 2 mono) | same | same | same |
| Client router cache | 0s | 0s | 0s | 0s |

## User-Perceived Issues

- Clicking between pages: visible blank gap (~500ms-1s before content)
- Toggling a checklist item: full page flash (9 queries re-run)
- Working the fila: result button causes full re-render
- Back/forward: always re-fetches from zero
- First load: text invisible until fonts download (FOIT)
