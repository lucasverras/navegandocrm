# Radar V7 — UX Audit

## /hoje (Home)

- **Objetivo:** Saber o que fazer agora e executar.
- **Ação principal:** Criar checklist / Trabalhar rodada / Resolver demanda.
- **Cliques para ação:** 1 (checklist: Enter; rodada: "Trabalhar" → fullscreen).
- **Informações úteis:** Checklists, rodadas com contagem, demandas com data, reembolsos pendentes.
- **Removidos:** KPIs genéricos, "leads score alto", "sem atividade 7d", "mensagens prontas", dashboard cards duplicados.
- **Melhorado:** Greeting personalizado, layout 2 colunas, stats strip na direita.
- **Pendente:** Mobile layout (2 colunas → stack).

## /prospeccao (Prospecção)

- **Objetivo:** Escolher restaurantes para abordar.
- **Ação principal:** Tinder (selecionar/descartar).
- **Cliques para Instagram:** 1 (atalho I).
- **Informações úteis:** Foto, ★ nota, reviews, telefone, @handle, bairro.
- **Removidos:** Score pré-destaque, badge de score bucket.
- **Melhorado:** Foto Google Places, atalhos I/W/G, prep em background, "Ver em tabela →".
- **Pendente:** Prefetch dos próximos 5-10 cards (§9).

## /pipeline (Pipeline)

- **Objetivo:** Gerenciar negociações ativas.
- **Ação principal:** Drag and drop / Follow-up quick / Abrir drawer.
- **Cliques para WhatsApp:** 1 (ícone no card).
- **Informações úteis:** Nome, telefone, @handle, round (FUP 1/2/3), proposta R$/mês, follow-up com semáforo.
- **Removidos:** Score, categoria, responsável, badges múltiplos.
- **Melhorado:** Contrast (borders, column bg, drag ring), per-column "Adicionar lead", drawer no click, round badge, follow-up D+1/2/5/10 no hover.
- **Pendente:** Pipeline layout V2 (§43 — testar 2 linhas).

## /resultados (Resultados)

- **Objetivo:** Controle financeiro — quanto gerei, quanto recebi, quanto falta.
- **Ação principal:** Verificar comissão / Editar cliente.
- **Cliques para editar:** 1 ("Editar" → dialog).
- **Informações úteis:** KPI strip denso, tabela com comissão/recebida/pendente por cliente.
- **Removidos:** Hero numbers gigantes (3×34px), quick-list duplicada, Mini cards 8×.
- **Melhorado:** Tabela como conteúdo principal, EditClientDialog (§56), per-client breakdown.
- **Pendente:** Editar via drawer em vez de dialog (§60).

## /historico (Histórico)

- **Objetivo:** Ver o que aconteceu com cada lead.
- **Ação principal:** Leitura (scroll).
- **Melhorado:** Mapa de eventos unificado (event-labels.ts), cadence_followup e proposal_sent agora têm rótulo.
- **Pendente:** Nada crítico.

## Drawer (Lead Drawer)

- **Objetivo:** Preview rápido sem sair da página.
- **Seções:** Próxima ação (reagendável), Oportunidade, Decisor, Mensagem, Reunião (com Meet), Proposta, Notas editáveis, Timeline.
- **Cliques para abrir:** 1 (click no card do pipeline, nome no Hoje, nome nos Prontos).
- **Melhorado:** De read-only com 1 gatilho → completamente funcional com 6+ gatilhos.

## Busca

- **Funciona:** Cmd+K (CommandPalette) busca leads por nome.
- **Pendente:** Adicionar ações no palette (§ Twenty Cmd+K pattern).

## Fullscreen modals

- **TrabalharFila:** Demandas urgentes uma por vez. Sem router.refresh.
- **TrabalharRodada:** Leads por contact_round. Mensagem sugerida, Copiar, WhatsApp, "Enviado ✓", resultados.
- **Tinder:** Um restaurante por vez. Foto, atalhos, background prep.
