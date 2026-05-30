# EPIC-07 — Importação de Planilhas Excel, PDF e OFX

## Status
Draft

## Visão Geral

Permitir que usuários importem extratos bancários em formato Excel (.xlsx), PDF e OFX/QFX diretamente para o Severino — tanto pelo WhatsApp (envio do arquivo na conversa) quanto pela interface web. O sistema lê o arquivo, detecta colunas automaticamente via IA (Excel/PDF) ou parse estruturado (OFX), categoriza cada transação usando o pipeline existente (heurísticas + Gemini) e insere no banco do usuário.

**Bancos suportados via OFX:** Bradesco, Itaú, Banco do Brasil, Caixa Econômica, Santander, Nubank e qualquer banco que exporte OFX v1.x (SGML) ou v2.x (XML).

## Motivação

Hoje o usuário precisa lançar cada transação manualmente via voz/texto no WhatsApp ou pelo modal da UI. Usuários com múltiplas transações mensais (ex.: extrato completo do mês) não conseguem importar em lote — limitação de adoção e retenção.

## Objetivo de Negócio

- Aumentar adoção: usuário experimenta o valor do Severino com 1 arquivo
- Reduzir atrito: importar 30 transações em vez de lançar 30 áudios
- Diferencial: categorização automática por IA no momento do import

---

## Arquitetura de Alto Nível

```
[WhatsApp: usuário envia arquivo .xlsx / .pdf / .ofx / .qfx]
        ↓
Evolution API webhook → buildBotBodyFromEvolutionSingle
        ↓ (NOVO: detectar documentMessage)
documentBufferFromEvolutionMedia (reusa getBase64FromMediaMessage)
        ↓
[API Web: POST /api/import/planilha multipart]
        ↓
server/lib/import/  (roteamento por mimeType/extensão)
  .xlsx/.xls/.csv → excel-parser.mjs  → Gemini detecta colunas → normaliza
  .pdf            → pdf-parser.mjs    → Gemini inline PDF → extrai transações
  .ofx/.qfx       → ofx-parser.mjs   → parser SGML/XML zero-dep → normaliza
        ↓
server/lib/import/import-service.mjs
  → batch categorize (suggestCategoryForTransaction, 10 por vez)
  → inserirTransacao para cada linha
  → retorna resumo {importadas, despesas, receitas, semCategoria}
        ↓
[WhatsApp reply]: "✅ Importei 47 transações: 40 despesas, 7 receitas. 2 sem categoria."
[Web UI]: modal de confirmação com preview + botão salvar
```

## Decisões Técnicas (Architect Review)

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Excel parsing | `xlsx` (SheetJS) | Leve, sem deps nativas, suporta .xlsx/.xls/.csv |
| PDF parsing | Gemini inline PDF | Não requer biblioteca de parsing; Gemini entende tabelas bancárias |
| OFX parsing | Parser manual zero-dep | OFX SGML é simples o suficiente; evita bibliotecas externas instáveis |
| Column detection (Excel) | Gemini (5 primeiras linhas) | Cada banco exporta diferente; IA é mais flexível que parsers hardcoded |
| OFX dedup | FITID (ID do banco) | Campo único por transação — superior ao hash de conteúdo |
| Categorização em batch | `suggestCategoryForTransaction` existente | Reutiliza pipeline já validado |
| Limite de tamanho | 10MB (xlsx/ofx) / 20MB (pdf) | Limite do Gemini para inline data; OFX são pequenos |
| WhatsApp integration | Mesma rota getBase64FromMediaMessage | Evolution API suporta documentos com o mesmo endpoint de áudio |

## Stories

| Story | Título | Deps | Estimativa |
|-------|--------|------|-----------|
| 7.1 | Excel Parser Backend | — | M |
| 7.2 | PDF Parser via Gemini Inline | — | M |
| 7.6 | OFX/QFX Parser Backend (zero-dep) | — | M |
| 7.3 | Batch Import Service | 7.1, 7.2, 7.6 | M |
| 7.4 | WhatsApp Document Handler | 7.3 | M |
| 7.5 | Web UI — Rota API + Upload | 7.3 | M |

## Critérios de Aceite do Epic

- [ ] Usuário envia .xlsx pelo WhatsApp e recebe confirmação com totais
- [ ] Usuário envia .pdf pelo WhatsApp e recebe confirmação com totais
- [ ] Usuário envia .ofx/.qfx pelo WhatsApp e recebe confirmação com totais
- [ ] Usuário faz upload via UI web (.xlsx, .pdf, .ofx) e vê preview antes de confirmar
- [ ] Transações importadas aparecem no dashboard com categoria correta
- [ ] Duplicatas do mesmo arquivo reenviado são detectadas (mesmo hash)
- [ ] Erros de parsing retornam mensagem clara (não 500)
- [ ] Arquivos > limite são rejeitados com mensagem explicativa

## Limitações Conhecidas

- PDFs escaneados (imagens) podem ter extração limitada (Gemini tenta OCR mas sem garantia)
- Bancos com formato muito incomum podem precisar de ajuste no prompt
- Gemini free tier: 37 usuários ativos/dia — importação em batch pode saturar quota em dias de uso intenso
