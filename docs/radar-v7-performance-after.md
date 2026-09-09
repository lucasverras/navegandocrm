# Radar V7 — Performance After

Measured 2026-09-09 after all V7 performance optimizations.

## Fixes Applied

| Fix | Impact | Detail |
|-----|--------|--------|
| Middleware: getUser→getSession | −200-300ms/navigation | Local JWT parse, no network |
| Prospecção: full rollup→count queries | −500ms+ on region list | 1 RPC-style batch instead of full table scan |
| All queries capped (limit 100-300) | Prevents degradation | No more unbounded result sets |
| router.refresh removed from optimistic UIs | −400ms/interaction | ChecklistPanel, TrabalharFila, TrabalharRodada no longer re-run 9 queries per click |
| Hoje: sequential→parallel | −100-200ms | Messages query in Promise.all (6→6 parallel, 0 sequential) |
| Pipeline: mensagem exata por lead | Evita prefill ausente | RPC latest_outreach_messages retorna uma linha por lead sem competição por um limite global |
| Font: display:swap + 5→3 weights | Instant text render | No more FOIT; 40% fewer font file downloads |
| staleTimes.dynamic = 30s | Instant back/forward | Client-side router cache for 30s |
| Admin client singleton | −10-30ms/API call | Module-level cache, no re-creation |

## Results

| Metric | BEFORE | AFTER | Improvement |
|--------|--------|-------|-------------|
| Queries per /hoje load | 11 (7 sequential) | 10 (6 parallel) | −1 query, zero waterfall |
| Queries per /pipeline load | 8 (4+4 sequential) | 7 (3 de página em paralelo + 1 RPC após os IDs; 3 do layout) | Menos queries e resultado correto por lead |
| Queries per /prospeccao load | 44 | ~20 (count queries) | −55% |
| router.refresh per checklist toggle | 1 (9 re-queries) | 0 | −100% |
| router.refresh per fila action | 1 (9 re-queries) | 0 | −100% |
| Font files | 7 | 5 | −29% |
| FOIT (Flash of Invisible Text) | Yes | No (swap) | Eliminated |
| Client router cache | 0s | 30s | Instant back/forward |
| Admin client per API call | New instance | Singleton | −10-30ms |

## Remaining Opportunities (P2/P3)

- Suspense boundaries on heavy sections (would let shell stream first)
- React.cache() for regions list (fetched on 5+ pages identically)
- Prospeccao RPC function (replace N×4 count queries with 1 SQL function)
- Partial Prerendering (experimental.ppr) when stable

## Integridade adicionada após a medição

- Resultados passou de 100 para até 1.000 clientes sem subcontar KPIs no volume atual.
- Contadores financeiros incrementais usam uma função SQL atômica.
- Alterações de contrato, mensalidade e comissão geram eventos auditáveis em client_finance_events.
- O funil de aquisição considera apenas record_source = radar; clientes históricos continuam nos KPIs financeiros sem inflar conversão.
