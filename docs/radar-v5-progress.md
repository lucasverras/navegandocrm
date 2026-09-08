# Radar Navegando — V5 overnight rebuild · progress

Running checkpoint log. The V5 brief is a 12-loop full reconstruction; this documents what has
actually shipped vs. what remains, honestly.

## Shipped (cumulative, across rounds — all live on prod via git→Vercel)
- **Light-first theme** (token flip in globals.css; `--color-accent-soft` wired so orange active pills render). Brand orange preserved as CTA/active/selected.
- **Nav reduced** to Hoje · Prospecção · Pipeline · Resultados · Histórico · Configurações.
- **Prospecção** one-at-a-time triage (SelectionQueue) + Encontrados/Selecionados/Prontos tabs.
- **Pipeline** 8 stages, whole-card drag, optimistic, "Entrar em contato" (WhatsApp pre-filled), phone + @Instagram visible, add-lead + create-manual-prospect.
- **Resultados**: Visão geral KPIs, Fechados, Comissões, Reembolsos. Finance rules frozen per
  client (legacy 10% recurring on INITIAL fee; one-time X% of one fee on first payment; partial
  payments). Receita gerada = months × fee. `src/lib/finance.ts` + tests (§44/45/48/97/98).
- **Manual results entry (this loop):** "+ Adicionar cliente" in Resultados creates a CLOSED
  client directly (name, região, origem, entrada/saída, mensalidade, commission rule, 1ª paga) —
  bypasses the funnel. For clients that already happened and are NOT leads. `POST /api/leads`
  gained an `as_client` mode + manual lead fields (region/origin/stage).
- ⌘K command palette, lead preview drawer, response auto-advance, follow-up quick-picker,
  prepare chaining, dashboard cockpit + compacted events, mobile action bar, Configurações
  (AI limits + global blocklist), reclassification of legacy junk data.

## Shipped (loop 2 — sales daily-driver)
- **Trabalhar Fila**: prioritized one-demand-at-a-time full-screen queue on Hoje (follow-up
  atrasado → reunião → follow-up hoje → pronto), WhatsApp pre-filled + resultado buttons that
  register and advance; "Fila concluída" end state.
- **Global "+ Novo lead"** in the sidebar (nome/WhatsApp/Instagram/região/origem/etapa).
- **Perdidos**: "Perder" on pipeline card (hover) → reason dialog; optimistic off-board; archived
  view shows reason + "Reativar". Endpoint `/api/leads/[id]/lose` (lose + reactivate).
- **Analytics tab** in Resultados: funil de conversão, fechados por região, motivos de perda,
  MRR acumulado (recharts lazy-loaded).
- **Histórico** rebuilt as a human, day-grouped timeline (translated events, collapses repeats).

## Not done yet (honest remainder of the V5 brief)
- Cadência automática D+2/D+5/D+10 (auto demand chain; the "sem resposta" in the fila sets +2 today).
- Reunião (data/hora/Meet) + Proposta (valor/obs/data) structured capture as first-class actions.
- Pipeline card Trello-minimal trim + field-narrowed query + virtualization (perf).
- Prospecção first level organized BY region with per-region funnel counts.
- Full component-level visual polish to Attio/Linear level — needs screenshot verification.
- Mobile pipeline single-column; Todas as demandas tabs; duplicate detection on manual create.
- Full component-level visual rebuild to Attio/Linear polish (only the token flip + targeted
  component work so far — needs a real visual pass with screenshots).
- "Trabalhar Fila" one-demand-at-a-time full-screen queue + "Todas as demandas" tabs.
- Cadência automática D+2/D+5/D+10 (demand generation; cancel on reply).
- Prospecção first-level organized BY region with per-region funnel counts.
- Analytics tab (funnel, by region, MRR-over-time, loss reasons) with charts.
- Perdidos flow (reason + reactivate); structured Reunião (data/hora/Meet) + Proposta capture.
- Histórico human timeline redesign.
- Global "+ Novo lead" button with origin/região/etapa + duplicate detection.
- Performance: pipeline field-narrowed query + virtualization; measured before/after.
- Trello import: needs the board CSV/JSON export (see docs/trello-import.md). Not fabricating
  cards from partial screenshots.
