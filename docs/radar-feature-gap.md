# Radar — Feature Gap Analysis (V6, set/2026)

Legenda: ✅ tem · ◐ parcial · — não tem · 💰 pago/enterprise
"Radar antes" = início da rodada V6 · "Radar agora" = após os loops desta rodada.

| Feature | Twenty | Odoo | Suite | Espo | Krayin | Radar antes | Radar agora | Vale? | Prio |
|---|---|---|---|---|---|---|---|---|---|
| Next action explícita por lead | — | ◐ (activity) | ✅ Next Step | ◐ (activities) | — | — | ✅ next_action_type/at + backfill | Sim | **P0 ✅** |
| Home = lista de trabalho (Late/Today/Future) | — | ✅ systray | ◐ | ✅ My Activities | ◐ | ◐ (7 queries, seções analíticas) | ✅ post-it 3 seções + chips | Sim | **P0 ✅** |
| Semáforo de vencimento (verde/laranja/vermelho) | — | ✅ | — | ◐ | ◐ rotten | ◐ (só atrasado) | ✅ Hoje + card pipeline | Sim | **P0 ✅** |
| Done & Schedule Next | — | ✅ | — | — | — | ◐ | ✅ fila: resultado agenda próximo | Sim | **P0 ✅** |
| Cadência declarativa (D+2/D+5/D+10) | — | ✅ Activity Plans | — | — | — | ✅ (1 botão só) | ✅ + follow-up rápido no card/drawer | Sim | **P0 ✅** |
| Triagem 1-por-vez (Tinder) | — | — | — | — | — | ✅ (sem foto, atalhos parciais) | ✅ foto Google, I/W/G, prep em background | Sim | **P0 ✅** |
| Foto do lugar na triagem | — | — | — | — | — | — | ✅ Places photos + proxy | Sim | **P0 ✅** |
| Preparação em background pós-seleção | — | — | — | — | — | — (manual em Selecionados) | ✅ serializada com toasts | Sim | **P0 ✅** |
| Record em side panel (não navegar) | ✅ | — | — | ◐ quick view | — | ◐ (drawer raso, 1 gatilho) | ✅ drawer completo, aberto de card/Hoje/Prontos | Sim | **P1 ✅** |
| Refino de mensagem em linguagem natural | — | — | — | — | ◐ Magic AI | — (refine booleano) | ✅ instruction + mais direta/curta + outro case | Sim | **P1 ✅** |
| "Por que essa mensagem" persistido | — | — | — | — | — | — (sumia no refresh) | ✅ rationale jsonb | Sim | **P1 ✅** |
| Valor da proposta no card do kanban | ✅ config | ✅ | — | ✅ config | ✅ | — | ✅ R$ X/mês | Sim | **P1 ✅** |
| Timeline humana unificada | ✅ | ✅ chatter | ◐ | ✅ stream | ◐ | ◐ (2 mapas divergentes) | ✅ lib/event-labels única | Sim | **P1 ✅** |
| Uma home só (sem dashboard duplicado) | ✅ | ✅ | — | ✅ | ✅ | — (Radar do dia + Hoje) | ✅ /dashboard → /hoje | Sim | **P0 ✅** |
| Add por coluna no kanban (Trello) | ◐ | ✅ | 💰 | ◐ | ✅ | — | ✅ rodapé de cada coluna | Sim | **P1 ✅** |
| Lost reasons estruturadas + restore | — | ✅ | ◐ | ◐ | ◐ | ✅ | ✅ mantido | — | feito |
| Kanban drag otimista | ✅ | ✅ | 💰 | ✅ | ✅ | ✅ | ✅ mantido | — | feito |
| Resultados financeiros (MRR, comissões) | ◐ dashboards | ✅ analysis | ✅ reports | 💰 | ◐ widgets | ✅ | ✅ + lista de fechados na visão geral | — | feito |
| Agregado MRR por coluna do kanban | ✅ | ✅ | — | — | ✅ | ◐ (só Fechado) | ◐ | Sim | P2 |
| Badge "esfriando" (rotten, tempo parado) | — | — | — | — | ✅ | — | — | Sim | P2 |
| Cmd+K com ações (não só navegação) | ✅ | — | — | ◐ | — | ◐ busca | ◐ | Sim | P2 |
| Origem × conversão em Resultados | — | ✅ | ✅ | 💰 | ◐ | — | — | Sim | P2 |
| Inline edit em listas (lápis no hover) | ✅ | ◐ | ◐ | ◐ | — | — | — | Talvez | P2 |
| Lista do pipeline com ações em massa | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | Talvez | P3 |
| Lead a partir de screenshot (Magic AI) | — | — | — | — | ✅ | — | — | Talvez | P3 |
| E-mail integrado / chatter de e-mail | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | **Não** (canal é WhatsApp) | nunca |
| Times/permissões/assignment | ✅ | ✅ | ✅ | ✅ | ◐ | — | — | **Não** (single-user) | nunca |
| Quotes com catálogo de produtos | — | ✅ | ✅ | 💰 | ✅ | — | — | **Não** (fee único) | nunca |
| Relatórios pivot/cohort genéricos | ◐ | ✅ | ✅ | 💰 | — | — | — | **Não** (4 números bastam) | nunca |

## O que foi implementado nesta rodada (P0/P1)

1. **Fundação next_action** (migração 0015) — todo endpoint mantém `next_action_type/at`;
   backfill de follow-ups, reuniões, propostas e mensagens prontas.
2. **Hoje = post-it** — 1 query (antes 7), seções Atrasados/Hoje/Próximos, chips §17,
   Concluídas do dia, fila → "Ver todas as demandas", datas em America/Sao_Paulo.
3. **/dashboard → /hoje** — "Radar do dia" removido (componentes deletados).
4. **Tinder V2** — foto do Google Places (field mask + coluna + proxy autenticado), atalhos
   A/→ X/← D U I W G (bindings de seta corrigidos), Selecionar → preparação em background
   serializada, score fora do destaque, Prontos com decisor/observação/mensagem/WhatsApp.
5. **Message Studio** — `instruction` livre reescrevendo a mensagem atual, Mais direta/curta,
   Usar outro case, rationale persistido ("por que essa mensagem").
6. **Pipeline** — labels "A abordar"/"Contato feito", proposta no card, follow-up D+1/2/5/10 no
   hover, add por coluna, clique abre drawer.
7. **Lead Drawer §50** — próxima ação (+reagendar), notas editáveis, decisor, mensagem,
   reunião, proposta, timeline; aberto de Pipeline/Hoje/Prontos/Leads.
8. **Histórico unificado** — lib/event-labels única (cadence_followup e proposal_sent tinham
   ficado sem rótulo em ambos os renderers).

## Performance (medido nesta rodada)

- Hoje: **7 queries → 1 (+1 de mensagens da fila, +1 só no chip Concluídas)** e índice parcial
  `idx_leads_next_action_at`.
- Layout: 1 count query a menos (mensagens prontas saiu do sidebar).
- Sem novas dependências; bundle inalterado (novo código é RSC na maior parte).

## Backlog honesto (P2/P3)

- P2: MRR somado por coluna; badge "esfriando"; ações no Cmd+K; origem × conversão em
  Resultados; auditoria fina de tokens (13px/4px em todas as telas).
- P3: lista do pipeline com bulk; lead por screenshot; import do Trello (infra pronta, aguarda
  export do usuário).
