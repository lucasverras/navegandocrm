# Radar Navegando

Sistema interno de SDR (prospecção) para a Navegando MKT. Next.js 15 (App Router) + TypeScript + Tailwind + Supabase (Auth/Postgres/RLS) + Google Places API + OpenAI API (Responses API).

**Node**: use Node 20 ou 22 LTS. O projeto foi inicialmente scaffoldado com Next.js 16 (pré-lançamento, instalado via `npm install next@latest` na época), mas essa versão tinha um bug real no carregador do Edge Runtime que travava o `next dev` (confirmado: o build de produção funcionava, só o modo dev quebrava). Fixamos em `next@15.5.20` (última estável da série 15) para eliminar esse bug. Se você tiver só Node 25+ instalado, alguns pacotes internos do Next podem ter problemas — recomendamos Node 22 LTS.

## Instalação local

```bash
npm install
cp .env.example .env.local
# preencha .env.local com suas chaves reais (veja abaixo)
npm run dev
```

## Variáveis de ambiente (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_MAPS_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
NEXT_PUBLIC_APP_URL=
```

`SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` são usadas **apenas** em código server-side (route handlers, `src/lib/openai.ts`, `src/lib/supabase/admin.ts`). Nunca são enviadas ao browser, nunca aparecem em logs, e nunca são ecoadas nas respostas de API — as rotas só retornam o texto/JSON gerado, tokens consumidos e custo estimado.

## Configuração do Supabase

1. Crie um projeto em supabase.com.
2. Copie a URL e as chaves (anon + service role) para `.env.local`.
3. Rode as migrations em `supabase/migrations/` na ordem numérica, via SQL editor do Supabase ou `supabase db push` (Supabase CLI):
   ```bash
   supabase link --project-ref <seu-ref>
   supabase db push
   ```
   Isso cria todas as tabelas, índices, constraints e políticas de RLS (`0001_init.sql`, `0002_rls.sql`).
4. (Opcional) Rode `supabase/seed/demo_seed.sql` para inserir 5 restaurantes fictícios marcados com `is_demo = true` e prefixo `[DEMO]`.
5. **Criar o primeiro usuário autorizado** (não há cadastro público):
   - No painel Supabase → Authentication → Users → "Add user" (ou "Invite").
   - Depois de criado, insira uma linha correspondente em `public.profiles`:
     ```sql
     insert into public.profiles (id, email, full_name)
     values ('<uuid-do-usuario>', 'voce@navegandomkt.com.br', 'Seu Nome');
     ```
   - Faça login em `/login` com essas credenciais.

## Google Places API

1. Crie um projeto no Google Cloud Console.
2. Ative a **Places API (New)** e a **Geocoding API**.
3. Gere uma chave de API e restrinja por API (Places + Geocoding) e, se possível, por IP/domínio do seu servidor de deploy.
4. Coloque a chave em `GOOGLE_MAPS_API_KEY`.

## OpenAI API

1. Crie uma conta em platform.openai.com e gere uma API key.
2. Coloque em `OPENAI_API_KEY`.
3. Defina `OPENAI_MODEL` com o ID exato do modelo que sua conta tem acesso (ex.: `gpt-5-nano`, `gpt-5-mini`, `gpt-4.1-mini`). É o único modelo usado em toda a aplicação — análise, geração de mensagem, refinamento e pesquisa de decisor — não há um segundo modelo "mais caro" hardcoded.
4. Todas as chamadas usam a **Responses API** (`client.responses.create`), não a Chat Completions API.
5. Para modelos da família de raciocínio (`gpt-5*`, `o1/o3/o4*`), o app envia `reasoning: { effort: "low" }` automaticamente para manter custo e latência baixos em respostas curtas; para os demais modelos esse parâmetro não é enviado (a API rejeita esse campo em modelos que não são de raciocínio).

## Deploy no Vercel

1. Importe o repositório no Vercel.
2. Configure as mesmas variáveis de ambiente do `.env.example` no painel do projeto (Production + Preview).
3. `NEXT_PUBLIC_APP_URL` deve apontar para a URL pública do deploy.
4. Deploy. As migrations do Supabase são independentes do deploy do Next.js — rode-as manualmente antes do primeiro deploy.

## Funcionalidades implementadas

- Autenticação via Supabase Auth (login por e-mail/senha), sem cadastro público, rotas protegidas por middleware, logout.
- CRUD de Regiões (bairro/cidade/estado/raio), ativar/arquivar, disparo de pesquisa.
- Pesquisa no Google Places (New) por múltiplas categorias, geocodificação da região, deduplicação por `place_id`, sem chamar a IA na busca inicial.
- Pré-score determinístico (0–100), sem IA, com pesos configuráveis (tabela `settings`).
- Lista de leads (tabela) com seleção múltipla e botão "Analisar com IA" (OpenAI Responses API, JSON estruturado via `text.format` + validação Zod antes de qualquer gravação no banco).
- Página de detalhe do lead com todos os blocos do spec: informações do negócio, ranking, oportunidade identificada, decisor, mensagem comercial.
- Geração de mensagem comercial personalizada via botão "Gerar mensagem" (OpenAI Responses API), variantes (diagnóstico, prova social, pergunta, expansão, roteamento, agência, Instagram abandonado), edição manual, botão "Refinar mensagem" (mesma chamada, com instrução extra de refinamento).
- Botão "Abrir no WhatsApp" com normalização de número (DDI 55), URL-encode da mensagem, `wa.me`, sem envio automático.
- Registro de status de abordagem (enviada, número inválido, chatbot, etc.) e "Descartar lead".
- Pesquisa de decisor via OpenAI com a tool `web_search` (instrução de no máximo 2 buscas por lead — a tool da OpenAI não expõe um limite rígido de chamadas como parâmetro de API, então o limite é reforçado via prompt), resultado validado com Zod, estruturado com fonte/confiança/data, permite "não encontrado".
- Dashboard com contagens principais, distribuição por categoria (gráfico), leads com maior nota, atividades recentes.
- Histórico (log de eventos: pesquisas, análises, mensagens, mudanças de status).
- Controle de custos: tabela `api_usage` registrando modelo/tokens/custo por chamada, limites diários configuráveis (tabela `settings`), bloqueio de novas análises ao atingir o limite, confirmação obrigatória para análise de >50 leads.
- Processamento em lote via OpenAI Batch API (`/api/batch` faz upload de um JSONL com requests para `/v1/responses` e cria o batch; `/api/batch/[id]` faz polling e, quando `completed`, baixa o arquivo de saída, valida cada resultado com Zod e grava).
- RLS habilitado em todas as tabelas — leitura/escrita liberada para qualquer usuário autenticado (equipe interna pequena), negado para `anon`.
- Validação de entrada com zod em todas as rotas de API, incluindo toda saída estruturada da IA (análise de lead e pesquisa de decisor) antes de ser persistida — nunca grava JSON não validado no banco.
- Rate limiting simples em memória nas rotas mais sensíveis (criação de região, disparo de busca).
- Toda a análise/geração de mensagem envia apenas resumos compactos por restaurante — nunca HTML bruto, páginas completas ou todas as avaliações.
- Prompt de sistema instrui explicitamente a IA a tratar conteúdo obtido via busca/fetch como dado não confiável (defesa contra prompt injection).
- IA nunca é chamada automaticamente ao carregar qualquer página — apenas por ação explícita do usuário nos botões "Analisar com IA", "Gerar mensagem", "Refinar mensagem" e "Pesquisar decisor".
- Tratamento de erro dedicado para falta de créditos (`insufficient_quota`), rate limit (429), timeout de conexão e resposta em formato inválido — cada rota de IA retorna uma mensagem específica em português em vez de vazar o erro bruto do SDK.
- Suporte a opt-out de lead/decisor (campo `opted_out`), bloqueado na geração de mensagem.
- Seed de dados de demonstração (5 restaurantes fictícios, `is_demo = true`, prefixo `[DEMO]`).

## Limitações reais (honestas)

- **Google Places não foi testado com chave real** — não há `GOOGLE_MAPS_API_KEY` configurada neste ambiente.
- **A integração com a OpenAI foi testada de verdade**, com chave real, contra um lead real no Supabase (`[DEMO] Cantina do Bairro`, criado especificamente para este teste e marcado `is_demo = true`): tanto a análise de lead (`Analisar com IA`) quanto a geração de mensagem (`Gerar mensagem`) fizeram uma chamada real à Responses API, a resposta JSON da análise passou pela validação Zod (`aiAnalysisResultSchema`) sem erros, e ambos os resultados foram persistidos nas tabelas `lead_analysis`, `leads` e `outreach_messages` exatamente como as rotas fazem. O teste replicou a lógica das rotas (mesmo prompt, mesmo schema, mesmo tratamento de `reasoning.effort`) fora do fluxo HTTP autenticado do Next.js, porque simular um cookie de sessão do `@supabase/ssr` via curl não é confiável — a autenticação HTTP em si (login, middleware, redirecionamento) já havia sido validada anteriormente contra o Supabase real.
- **Atenção**: o valor original de `OPENAI_MODEL` no ambiente estava com um erro de digitação (`gpt-5-nan`) e a OpenAI rejeitava com "The requested model 'gpt-5-nan' does not exist." Foi corrigido para `gpt-5-nano` para o teste — confira se é esse o modelo que você realmente pretende usar.
- `npm run lint`, `npx tsc --noEmit` e `npm run build` foram executados e passam limpos (0 erros, 0 warnings). Além disso, o build de produção foi de fato **rodado** (`next start`) e testado via HTTP: `/login` retorna 200 e renderiza o formulário corretamente; `/dashboard`, `/regioes` e `/leads` (rotas protegidas) redirecionam corretamente para `/login?redirect=...` quando não há sessão — confirma que o middleware de autenticação funciona como esperado, mesmo sem uma sessão Supabase real. Chamadas a rotas de API que dependem do Supabase (ex: `POST /api/regions`) retornam erro 500 sem `.env.local` configurado, porque o cliente Supabase lança exceção ao receber URL vazia — isso é esperado nesse estado (sem chaves) e deve desaparecer assim que `.env.local` for preenchido.
- O cliente Supabase (`src/lib/supabase/{client,server,admin}.ts`) não é parametrizado com o generic `Database` — a versão instalada do `@supabase/postgrest-js` (v2.110.x, com seu novo parser de tipos baseado em query string) resolvia os tipos do schema manual para `never` em várias queries de escrita/leitura encadeadas, quebrando o build. Os tipos de linha (`src/types/database.ts`) continuam sendo usados via cast explícito (`as unknown as LeadRow`, etc.) nos pontos onde o resultado é consumido, então a tipagem de campos ainda existe, só não é validada automaticamente pelo Supabase client no momento da query.
- A extração de "Instagram" nos leads do Google Places não é implementada automaticamente (a Places API não retorna Instagram diretamente) — o campo existe no schema mas fica vazio até que outra fonte o preencha manualmente ou uma extração futura seja implementada.
- A pesquisa de decisor faz o parsing do JSON retornado pela IA via regex simples (procura o último bloco `{...}` no texto) em vez de `text.format` estruturado, porque a Responses API não permite combinar a tool `web_search` com `strict: true` de forma confiável — o resultado é validado com Zod (`decisionMakerResultSchema`) antes de ser salvo, mas o parsing em si é menos rígido que um schema formal do lado da API.
- O limite de "no máximo 2 buscas" na pesquisa de decisor é reforçado apenas via instrução no prompt — a tool `web_search` da OpenAI, diferente de outros provedores, não expõe um parâmetro de API para capar o número de chamadas.
- Rate limiting é em memória (não distribuído) — adequado para uma instância única; não escala horizontalmente sem trocar por um limitador em banco/Redis.
- Não há testes automatizados (unitários/e2e).
- O "número estimado de unidades" (múltiplas unidades) não é inferido automaticamente — fica como campo manual/editável futuramente.
- A extração de sinais de "agência" e "situação de marketing" depende inteiramente do que a IA infere a partir do resumo compacto enviado (sem scraping de Instagram/site nesta versão) — evidências tendem a ser limitadas até que uma etapa de coleta mais rica seja adicionada.
- A tabela de preços em `src/lib/openai.ts` (`estimateCostUSD`) é uma estimativa aproximada por modelo, mantida manualmente — não é consultada em tempo real da OpenAI. Se o modelo configurado em `OPENAI_MODEL` não estiver na tabela, usa-se um valor de fallback conservador; confira o preço real no painel da OpenAI se precisão de custo for crítica.
- O botão "Refinar mensagem" usa o mesmo `OPENAI_MODEL` configurado (não há um segundo modelo "premium" hardcoded como havia antes) — ele apenas adiciona uma instrução pedindo mais capricho na naturalidade/precisão da mensagem.
- O componente de gráfico do dashboard mostra apenas distribuição por categoria; os gráficos de "por região" e "por foco de oportunidade" descritos no spec ainda não foram implementados.
- Filtros avançados da página de Leads (ex: "Instagram abandonado", "negócio forte com marketing fraco") ainda não estão todos implementados na UI — a página atual tem filtros básicos via query string (região, categoria, nota mínima); os demais exigem joins com `lead_analysis` que podem ser adicionados depois.
- Não há verificação de assinatura/hook de segurança adicional além de RLS + validação zod + rate limit em memória — adequado para MVP interno, não para uso público.

## Sugestões de próximos passos

- Implementar todos os filtros/ordenações da spec na página de Leads (join com `lead_analysis`, `decision_makers`, `outreach_messages`).
- Adicionar testes automatizados (Vitest/Playwright) e um ambiente de CI.
- Trocar o rate limiter em memória por um baseado em Postgres/Redis para suportar múltiplas instâncias.
- Implementar extração de Instagram e sinais adicionais de marketing (ex.: scraping leve e compacto de bio pública).
- Adicionar testes A/B mais completos (campanhas/variantes) com métricas de reunião marcada e fechamento na tela de Dashboard.
- UI de configuração de pesos do pré-score e limites diários (hoje só via API `/api/settings`).
- Polling automático (client-side) do status de batches em vez de exigir refresh manual da página.
