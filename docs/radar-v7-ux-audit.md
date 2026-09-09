# Radar V7 — UX Audit

## /hoje (Home)

- **Objetivo:** Saber o que fazer agora e executar.
- **Ação principal:** Criar checklist / Trabalhar rodada / Resolver demanda.
- **Cliques para ação:** 1 (checklist: Enter; rodada: "Trabalhar" → fullscreen).
- **Informações úteis:** Checklists, rodadas com contagem, demandas com data, reembolsos pendentes.
- **Removidos:** KPIs genéricos, "leads score alto", "sem atividade 7d", "mensagens prontas", dashboard cards duplicados.
- **Melhorado:** Greeting personalizado, layout 2 colunas, stats strip na direita.
- **Mobile:** Layout empilhado, busca e novo lead no topo, navegação inferior fixa.

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
- **Mobile:** Uma etapa por vez, coluna em largura total e ações de follow-up/perda sempre visíveis ao toque.

## /resultados (Resultados)

- **Objetivo:** Controle financeiro — quanto gerei, quanto recebi, quanto falta.
- **Ação principal:** Verificar comissão / Editar cliente.
- **Cliques para editar:** 1 ("Editar" → dialog).
- **Informações úteis:** KPI strip denso, tabela com comissão/recebida/pendente por cliente.
- **Removidos:** Hero numbers gigantes (3×34px), quick-list duplicada, Mini cards 8×.
- **Melhorado:** Tabela como conteúdo principal, EditClientDialog (§56), per-client breakdown.
- **Mobile:** Cards financeiros substituem a tabela de 11 colunas; Editar abre bottom sheet com rolagem e altura limitada.

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
- **Mobile:** Gatilho de busca disponível no cabeçalho.

## Fullscreen modals

- **TrabalharFila:** Demandas urgentes uma por vez. Sem router.refresh.
- **TrabalharRodada:** Leads por contact_round. Mensagem sugerida, Copiar, WhatsApp, "Enviado ✓", resultados.
- **Tinder:** Um restaurante por vez. Foto, atalhos, background prep.

## Simulação mobile

- Executada em Chrome headless com viewport de 390×844.
- /hoje: sem overflow horizontal, busca, novo lead e cinco destinos no bottom nav.
- /pipeline: troca de etapa, cards em largura total e ações por toque verificadas.
- /resultados?tab=fechados: 20 cards renderizados; botão Editar abriu o diálogo e ele coube no viewport.
- Evidências locais: .context/mobile-hoje.png, .context/mobile-pipeline.png e .context/mobile-resultados-edit.png.

## Simulação diária completa

- Executada com usuário e leads temporários contra o build de produção local.
- Caminho ganho: criar lead → mensagem enviada → cadência → resposta com nota → reunião → reunião realizada → proposta → proposta aceita → fechamento → alteração de mensalidade → primeira mensalidade paga → comissão recebida.
- Estado final validado: cliente fechado, business_status client, sem próxima ação, mensalidade atual R$ 4.500, comissão recebida R$ 500 e quatro eventos financeiros.
- Caminho perdido: criar lead → perder → reativar; voltou para A abordar com FIRST_CONTACT e próxima ação definida.
- O botão Editar foi aberto e salvo em Resultados no viewport 390×844.
- Usuário e leads de teste foram removidos depois da execução.
