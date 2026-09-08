# CRM Reference Study — Radar Navegando V6

Estudo de padrões de 5 CRMs open source maduros (set/2026), feito para responder UMA pergunta:
**o que produtos maduros fazem bem que serve ao fluxo do Radar** (restaurante → Instagram →
mensagem → WhatsApp → follow-up → reunião → proposta → fechado)?

Nenhum código foi copiado. Fontes: repositórios GitHub, documentação oficial e docs-repos.
Formato: **PADRÃO → REFERÊNCIA → COMO APLICAR NO RADAR** (✅ = já aplicado nesta rodada).

---

## 1. Twenty CRM (AGPLv3; pacotes UI em MIT; partes Enterprise comerciais)

**Por que parece produto e não admin template:** base tipográfica de 13px, grid de espaçamento
de 4px, só 3 pesos de fonte (400/500/600), hierarquia por 5 tons de cinza, linha de tabela de
32px, affordances só no hover (lápis de edição inline), side panel fixo de ~500px, animações de
75–300ms, empty states com ação ("Add your first X").

- **Fortes:** sistema de tokens curto e rigoroso; edição inline em tudo; Cmd+K que navega E age;
  kanban com campos configuráveis + modo compacto + agregados por coluna; record = estado à
  esquerda, histórico em abas.
- **Fracos:** sem motor de atividades/cadência; sem won/lost nem lost reasons nativos; genérico
  demais (você monta o processo); stack pesada (Nx/GraphQL/Redis).

**PADRÃO → COMO APLICAR:**
1. Side panel em vez de navegar (OpenRecordIn.SIDE_PANEL) → ✅ clique no card/linha abre o Lead
   Drawer com próxima ação, notas, decisor, mensagem, reunião, proposta e timeline.
2. Agregados por coluna (count/sum) → coluna do kanban mostra contagem; "Fechado" mostra soma
   (✅ parcial — closedTotal já existe; MRR por coluna é P2).
3. Empty state acionável → ✅ Hoje vazio: "Nada por hoje" + botão "Prospectar novos restaurantes".
4. Densidade 13px/4px/32px → P2: auditoria fina de tokens (o Radar já usa 13px/Jakarta em
   grande parte; consolidar escala é polish contínuo).
5. Cmd+K navegar+agir → parcial: a busca global existe; ações no palette são P2.

**NÃO trazer:** objetos/layouts configuráveis, views compartilháveis multiusuário, editor de
notas por blocos, workflows genéricos, a stack.

## 2. Odoo CRM (Community LGPLv3)

**A referência de ACTIVITIES.** Tipos de atividade com due date; cores **verde = futuro,
laranja = hoje, vermelho = atrasado** em card, lista, record e no systray global (agrupado
Late/Today/Future); "**Done & Schedule Next**" conclui e já abre a próxima; encadeamento por
tipo (Suggest/Trigger Next Activity) com prazo relativo à CONCLUSÃO; **Activity Plans** criam a
sequência inteira de uma vez; Lost com **Lost Reason** estruturada + Closing Note + Restore.

- **Fortes:** o melhor modelo mental de "o que fazer agora"; lost reasons analisáveis; Pipeline
  Analysis com MRR pronto.
- **Fracos:** estética de ERP; plataforma enorme; config espalhada; mobile oficial só Enterprise.

**PADRÃO → COMO APLICAR:**
1. Semáforo de vencimento → ✅ Hoje (Atrasados vermelho / Hoje âmbar / Próximos neutro) e card
   do pipeline (follow-up atrasado/hoje colorido).
2. Systray Late/Today/Future → ✅ é exatamente a estrutura do novo Hoje.
3. Done & Schedule Next → ✅ na fila: registrar resultado já agenda o próximo (respondeu → D+2,
   sem resposta → cadência D+2/D+5/D+10); a resposta cancela a cadência.
4. Cadência relativa à conclusão → ✅ a cadência conta a partir do clique ("sem resposta"), não
   da data planejada.
5. Lost reason + Restore → ✅ já existia (Perdidos com motivo + reativar); mantido.
6. Atividade visível no card do kanban → ✅ linha de follow-up/reunião no card + quick action.

**NÃO trazer:** sales teams/assignment, config de activity types pelo usuário, chatter com
e-mail threading, pivot/cohort genéricos, quotations com catálogo.

## 3. EspoCRM (AGPLv3 desde 8.1)

**A referência de STREAM.** O Activity Stream grava criação, posts, e-mails, mudanças de status
e de campos auditados como um feed humano por registro; painel **Activities mostra só o futuro**
(Planned) e **History só o passado** (Held/Not Held) — a passagem é automática por status, nunca
arquivamento manual. Atalhos: Ctrl+Space cria de qualquer lista, Ctrl+/ busca.

- **Fortes:** timeline automática sem esforço; futuro/passado por status; kanban genérico por
  dropdown; filtros em camadas com presets.
- **Fracos:** atrasados não são cidadãos de primeira classe no dashboard; relatórios pagos; sem
  campo de próximo passo.

**PADRÃO → COMO APLICAR:**
1. Timeline automática misturando eventos de sistema + notas → ✅ outreach_events com rótulos
   humanos unificados (lib/event-labels) no Histórico, na página do lead e no drawer.
2. Futuro vs passado por status → ✅ demanda concluída sai sozinha do Hoje (next_action muda) e
   vira linha de histórico; chip "Concluídas" lista o que foi resolvido hoje.
3. Quick-create global → ✅ já existia ("+ Novo lead" no sidebar); mantido.

**NÃO trazer:** follow/unfollow, menções, reações, ACL de times, portal do cliente, mass e-mail.

## 4. SuiteCRM 8 (AGPLv3)

**A referência de NEXT STEP.** Campo livre "Next Step" na Opportunity — "the immediate next
action required to progress the deal"; Activities (Planned) viram **History** automaticamente
quando marcadas Held; Lead Source com vocabulário fechado; Quick Filters como botões de um
clique; status de lead com estados terminais explícitos (Dead vs Recycled).

- **Fortes:** resposta explícita a "qual o próximo passo"; trilha Activities→History automática;
  filtros salvos de um clique; Reports no core.
- **Fracos:** sem kanban no core; histórico fragmentado em subpanéis; peso enterprise (10
  estágios, RSVP, recorrência).

**PADRÃO → COMO APLICAR:**
1. Next Step → ✅ **next_action_type + next_action_at em todo lead ativo** (migração 0015),
   mantidos por TODOS os endpoints (resposta, cadência, reunião, proposta, fechar, perder,
   mensagem pronta, entrar no board). O Hoje nasce disso.
2. Held ⇒ History automático → ✅ todo endpoint grava outreach_events; nada de arquivar demanda.
3. Lead Source fechado → ✅ já existia (lead_origin: radar/indicação/evento/…); cruzamento com
   conversão em Resultados é P2.
4. Quick Filters de um clique → ✅ chips do Hoje (Todas/Atrasadas/Hoje/Amanhã/7 dias/Sem
   data/Concluídas).
5. Dead vs Recycled → ✅ triagem já distingue "descartado" (com motivo) de "ver depois".

**NÃO trazer:** 10 estágios, invitees/RSVP/recorrência, dashboards multi-abas, security groups.

## 5. Krayin CRM (MIT)

**A referência de simplicidade de modelo.** Lead = deal (sem entidade Opportunity separada);
kanban no core com drag & drop + toggle lista com ações em massa; **rotten leads** — cada
estágio tem "rotting days" e o lead parado ganha alerta vermelho; Magic AI cria lead de
foto/PDF; atividades Call/Meeting/Lunch com grid filtrável.

- **Fortes:** rotten days (urgência automática por tempo parado); lead=deal; kanban core; MIT.
- **Fracos:** sem busca global documentada; sem stream de auditoria; sem push; docs rasas.

**PADRÃO → COMO APLICAR:**
1. Lead = deal → ✅ confirmado o modelo do Radar (registro único com fee mensal). Não criar
   entidade de oportunidade.
2. Rotten leads → parcial: o semáforo de atraso cobre urgência por data; badge "esfriando" por
   tempo parado no estágio é P2.
3. Toggle kanban↔lista → ✅ "Ver em tabela →" na triagem; lista do pipeline é P3.
4. Magic AI (lead de screenshot) → P3 — ideia boa, não é gargalo hoje.

---

## Síntese transversal

Os cinco resolvem "o que fazer agora?" por caminhos diferentes: **Espo** por *status temporal*
(Activities vs History), **Suite** por *campo declarativo* (Next Step), **Odoo** por *motor de
atividades com semáforo e encadeamento*, **Krayin** por *pressão de tempo* (rotten days),
**Twenty** não resolve — mas define *como deve parecer* (densidade, side panel, inline, calma).

O Radar V6 combina: **next_action do Suite** + **semáforo/Late-Today-Future/Done&Next do Odoo**
+ **timeline automática do Espo** + **lead=deal do Krayin** + **drawer/empty-states do Twenty** —
e deixa do lado de fora todo aparato multiusuário (times, follow, invitees, RSVP, permissões),
que é exatamente o peso que um SDR solo não deve pagar.
