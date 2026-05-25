# ADR 0001 — PDF do Relatório fica no cliente

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-05-25 |
| Escopo | `src/pages/Relatorios.jsx`, `src/lib/relatorioExportPdf.js` |
| Alternativa avaliada | Mover geração para Vercel Function (`/api/relatorios/pdf`) |

## Contexto

O Relatório Analítico exporta um PDF com totais e tabela de transações. Hoje o
PDF é gerado no navegador com `jspdf` + `jspdf-autotable` (~140 KB gzipped),
carregados via `import()` lazy + prefetch on hover/focus do botão.

A pergunta levantada no round arquitetural: vale mover para uma Vercel Function?

## Decisão

**Manter no cliente.** Extrair o gerador para um módulo isolado
(`src/lib/relatorioExportPdf.js`) com injeção de dependência (jsPDF/autoTable
recebidos como parâmetro), preparando o terreno para uma migração futura sem
forçá-la agora.

## Trade-offs avaliados

| Critério | Cliente (atual) | Vercel Function |
|---|---|---|
| Bundle inicial | 0 KB (lazy) | 0 KB |
| 1ª exportação | ~140 KB já pré-aquecido on hover | +600ms a 1.2s cold start |
| Round-trip extra | 0 | +1 (cliente → function → blob) |
| Lógica duplicada (filtro/dados) | Não | Sim — refazer query OU enviar payload |
| Testabilidade | OK (módulo puro extraído) | OK |
| Risco de migração | Nenhum | Médio: jspdf-autotable em Node tem caveats (canvas, fonts) |
| Custo Vercel | Nenhum | Compute por export |

O ganho teórico (`-140 KB` que ninguém paga em runtime, dado o lazy + prefetch)
não justifica o custo real de cold start, payload duplicado e operação.

## Quando reabrir esta decisão

Mover para servidor passa a fazer sentido se aparecer pelo menos um destes:

1. **PDF assinado/marca d'água do servidor** (compliance ou branding controlado).
2. **Geração agendada** (cron envia relatório por e-mail no dia 1 de cada mês).
3. **Volume gigante** (dezenas de milhares de linhas) onde a CPU do cliente vira
   gargalo perceptível.
4. **Deduplicação real**: se outro consumidor (mobile nativo, e-mail bot) também
   precisar do mesmo PDF, vale centralizar.

Quando isso acontecer, a migração é mecânica: `buildRelatorioPdfDoc` já é puro
e portável, basta criar `api/relatorios/pdf.js` que importa jsPDF + autoTable
no Node, chama a função com os mesmos parâmetros e devolve o `output('arraybuffer')`.

## Consequências

- Pequena mudança no `Relatorios.jsx`: o handler `exportToPDF` passou a delegar
  pra `buildRelatorioPdfDoc` + `downloadRelatorioPdf`. Comportamento idêntico.
- Testes unitários do gerador (`relatorioExportPdf.test.mjs`) passam a cobrir
  a montagem do documento sem precisar carregar jspdf no Vitest (mock).
- Convenção: novos formatos de export (Excel, etc.) seguem o mesmo padrão —
  módulo puro em `src/lib/`, deps pesadas injetadas pelo caller.
