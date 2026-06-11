# Análise — Entendimento de IA (texto + voz) no WhatsApp Bot

> Data: 10-jun-2026 · Escopo: agenda, cadastro de receitas/despesas, listas, pipeline de voz e roteamento.
> Método: exploração do código por 4 agentes (server/lib/domain/whatsapp-bot.mjs, ai-whatsapp.mjs, agenda-whatsapp.mjs, ai-lista-compras.mjs, transaction-heuristics.mjs e relacionados).

## Como funciona hoje (visão geral)

```
Mensagem (texto ou áudio)
  → regex especializadas primeiro (agenda, lista, extrato, saldo, limites, desfazer, corrigir…)
  → senão: parse IA (Gemini 2.5-flash → fallback Groq Llama → heurística local)
       texto: 1 call → JSON {tipo, valor, descricao, categoria, data}
       áudio: 1 call combinada (transcrição + classificação) → fallback Groq Whisper + pipeline de texto
  → enriquecimento: correções do usuário (override determinístico) > 224 heurísticas regex > LLM > "Outros"
  → cache Redis+memória por (mensagem, data BRT, usuário), TTL 24h
```

Pontos fortes confirmados: fallback em 3 camadas, few-shot por usuário (títulos e categorias corrigidas),
parsing verbal BR robusto ("dois mil e quinhentos"), áudio em 1 call (rápido/barato), telemetria em /api/health.

---

## Fraquezas encontradas (com evidência)

### Transversais (afetam tudo)

| # | Fraqueza | Evidência | Severidade |
|---|----------|-----------|-----------|
| T1 | **Sem histórico conversacional** — follow-up ("muda pra 15h", "na verdade foi 60", "não, era receita") não funciona; `askHorizon` recebe `historico=[]` sempre | whatsapp-bot.mjs:654 | **CRÍTICA** |
| T2 | **Zero desambiguação interativa** — nenhum fluxo pergunta "você quis dizer X?"; tudo resolve por default silencioso | todos os fluxos | **ALTA** |
| T3 | Cache parse-tx pode congelar interpretação errada por 24h (mesma mensagem → mesma resposta, mesmo após correção) | ai-whatsapp.mjs:261 | MÉDIA |
| T4 | Sem rate limit de IA por usuário (abuso de quota possível) | inexistente | MÉDIA |
| T5 | Roteamento regex-first cria edge cases: "pagar conta sexta" vira AGENDA (keyword) e não despesa agendada | whatsapp-bot.mjs:392 | BAIXA |
| T6 | Áudio é baixado e parseado antes do gate de trial (desperdício de quota) | whatsapp-bot.mjs:323-351 | BAIXA |

### Agenda

| # | Fraqueza | Evidência | Severidade |
|---|----------|-----------|-----------|
| A1 | **Sem recorrência** — "me lembra todo dia de tomar remédio" cria 1 evento; hardcoded `nao-recorrente` | agenda.mjs:154 | **ALTA** |
| A2 | **Default 09:00 silencioso** quando só há data ("reunião sexta" → sexta 9h sem avisar) | agenda-whatsapp.mjs:345 | **ALTA** |
| A3 | "às 5" assume 17h sem confirmar (1–6 = PM por heurística) | agenda-whatsapp.mjs:277 | MÉDIA |
| A4 | Lembrete pedido ("avise 17 min antes") é arredondado p/ [0,5,10,15,30,60] sem avisar | agenda-whatsapp.mjs:558 | BAIXA |
| A5 | Confirmação pós-criação só pergunta lembrete; nunca valida título/data extraídos | agenda-whatsapp.mjs:897 | MÉDIA |
| A6 | No áudio, o título vem de 1 call Gemini sem a cadeia de fallback do texto (Groq→Gemini→heurística) | whatsapp-bot.mjs:623 | BAIXA |

### Transações (receitas/despesas)

| # | Fraqueza | Evidência | Severidade |
|---|----------|-----------|-----------|
| X1 | **Parcelamento não detectado** — "comprei em 3x" vira 1 transação com valor total; backend JÁ suporta parcelamento (2-120), o prompt não menciona | prompt ai-whatsapp.mjs:182-251 | **ALTA** |
| X2 | **Recorrência não detectada** — "assinei X, 40 por mês" não vira recorrente; backend já suporta (MENSAL/SEMANAL/ANUAL) | idem | **ALTA** |
| X3 | **Confirmação não mostra a categoria** — usuário só descobre erro de categoria abrindo o app; comando "corrigir categoria" existe mas é invisível | whatsapp-bot.mjs:767 | **ALTA** |
| X4 | Múltiplas transações numa mensagem não suportadas ("50 no mercado e 30 na farmácia" → 1 JSON) | prompt retorna objeto único | MÉDIA |
| X5 | Transação futura ("vou pagar 500 sexta") sempre vira EFETIVADA; status PENDENTE existe no schema mas o parse nunca usa | resolveDataTransacaoParaBot | MÉDIA |
| X6 | "cinco e vinte" (R$5,20) vs "vinte e cinco" (R$25) depende só do LLM; fallback verbal local não cobre | transaction-heuristics.mjs:377 | BAIXA |
| X7 | Heurística pode sobrepor a categoria do LLM sem o usuário ver (tem telemetria, não tem feedback) | transaction-heuristics.mjs:306 | BAIXA |
| X8 | Fallback final (IA toda fora) perde categoria → tudo em "Outros" silenciosamente | fallbackParseMensagemSimples | BAIXA |

### Listas

| # | Fraqueza | Evidência | Severidade |
|---|----------|-----------|-----------|
| L1 | **Remover/marcar via NL não funciona** — regex detecta "tira o leite da lista" e ativa o fluxo, mas o prompt só tem 4 intents (ADICIONAR/CRIAR/VER/CHAT) → cai em CHAT genérico | ai-lista-compras.mjs:14-80 vs lista-compras-whatsapp.mjs:34-36 | **ALTA** (quase bug) |
| L2 | **Listas de tarefas não criáveis via WhatsApp** — tipo hardcoded `compras` + categoria_financeira `Alimentação` | lista-compras-whatsapp.mjs:172 | **ALTA** |
| L3 | Fuzzy match de nome de lista lenient (match parcial/inverso) sem confirmação → item na lista errada | lista-compras-whatsapp.mjs:57-70 | MÉDIA |
| L4 | Sem fallback determinístico — se Gemini+Groq caem, lista fica 100% indisponível (transação tem heurística local; lista não) | ai-lista-compras.mjs:202 | MÉDIA |
| L5 | "uma dúzia" ambígua (12un vs 1dz) — prompt deixa o modelo escolher | prompt linha 42-48 | BAIXA |
| L6 | Multi-item em linha única pode colapsar em 1 item malformado (sem validação pós-parse) | normalizeListaResult | BAIXA |

---

## Plano de melhorias recomendado

### Pacote 1 — Quick wins (só prompt + wiring, ~1 dia, alto impacto)

1. **L1 — intents REMOVER_ITENS e MARCAR_COMPRADO** no prompt de lista + handlers (backend de toggle/delete já existe via API).
2. **X1/X2 — parcelamento e recorrência no prompt de transação** (`"em 3x"` → `parcelamento:{num_parcelas:3}`; `"todo mês"` → `recorrencia:{frequencia:'MENSAL'}`) — a validação e o processamento já existem no backend; é ensinar o LLM a preencher e ligar os campos no insert do bot.
3. **X3 — mostrar categoria na confirmação** + dica contextual: `📊 Alimentação › Supermercado — errou? responda "corrigir categoria <nome>"`. Transforma o few-shot de correções (que já existe) num loop de aprendizado de verdade.
4. **A2 — declarar o default**: "Marquei p/ sexta às **09h** (não disse horário — responda outro horário p/ ajustar)". Não bloqueia, mas elimina a surpresa.
5. **L2 — tipo de lista**: detectar "lista de tarefas" no prompt e passar `tipo:'tarefas'` (campo já existe na migration 55).

### Pacote 2 — Recorrência de agenda + follow-up curto (~2-3 dias)

6. **A1 — recorrência na agenda**: parsear "todo dia/toda segunda/todo dia 5" (o prompt de áudio já extrai título; adicionar campo `recorrencia`) e criar a série.
7. **T1 — memória conversacional curta**: guardar as últimas 4-6 trocas por telefone no Redis (TTL 10-15 min) e injetar no `askHorizon` + permitir follow-up de correção ("muda pra 15h" → editar último evento; "na verdade foi 60" → corrigir última transação). É a melhoria de maior impacto percebido — hoje o bot "esquece" tudo a cada mensagem.

### Pacote 3 — Desambiguação seletiva (~2 dias, medir antes)

8. **T2 — confirmação só quando a confiança é baixa**: pedir confirmação apenas em casos objetivamente ambíguos (fuzzy match de lista não-exato; valor verbal ambíguo; "às 5" sem período). Em alta confiança, manter o fluxo direto (a agilidade é o diferencial do produto).
9. **X4 — multi-transação**: prompt retorna array; bot grava em lote e confirma o conjunto.

### Backlog (menor urgência)
- X5 transação futura → PENDENTE; T4 rate limit de IA por usuário; T6 gate antes do download de áudio; L4 fallback regex p/ lista; A4 informar arredondamento do lembrete; T3 invalidar cache parse-tx após "corrigir".

### Métricas para validar (já existem dados!)
- `agenda_title_log` (qualidade de título) e `categoria-heuristica-log` (LLM vs heurística) já são gravados — montar query semanal de taxa de correção por fluxo é o jeito mais barato de priorizar com dados reais.
- /api/health.ia: acompanhar % fallback Groq e cache hit.
