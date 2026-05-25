# ADR 0002 — Drift de migrations Supabase e convenção daqui pra frente

| Campo | Valor |
|---|---|
| Status | Aceito |
| Data | 2026-05-25 |
| Escopo | `scripts/migrations/`, processo de schema |
| Contexto | Auditoria de drift no round 13 |

## Estado encontrado (2026-05-25)

Auditoria via MCP Supabase (`list_migrations`, `get_advisors`,
`information_schema.tables/columns`) revelou:

| Item | Quantidade | Detalhe |
|---|---:|---|
| Migrations no repo | 47 | numeradas 01..48 (25 = Stripe, removida) |
| Rastreadas em `supabase_migrations.schema_migrations` | 9 | da 39 em diante |
| Aplicadas mas não rastreadas | 37 | 01..24, 26..38 (schema bate com elas) |
| **Drift real (não aplicada)** | **1** | **48_refresh_tokens_rls** |

### Drift de segurança ativo

`get_advisors` retornou um lint **ERROR-level**:

```
rls_disabled_in_public  →  public.refresh_tokens
```

A tabela tem 31 tokens ativos. RLS desabilitado significa que, se a chave
anon vazar, qualquer um pode ler/escrever tokens. A migration que corrige
isso (`scripts/migrations/48_refresh_tokens_rls.sql`) está no repo desde o
round 9 mas o SQL não foi executado no banco.

## Ação imediata requerida do usuário

O MCP Supabase no Cursor está em modo read-only (`Cannot apply migration in
read-only mode` / `cannot execute ALTER TABLE in a read-only transaction`).
A aplicação precisa ser feita manualmente:

1. Abrir o **SQL Editor** do projeto no Supabase Dashboard
   (`https://supabase.com/dashboard/project/zesyderishnbjrpfbmqa/sql`).
2. Colar o conteúdo de `scripts/migrations/48_refresh_tokens_rls.sql`
   (ou copiar do bloco abaixo).
3. Run. O efeito é instantâneo e seguro: `service_role` (chave usada pela API)
   **bypassa RLS por design**, então nenhum endpoint quebra. O que muda é que
   `anon` e `authenticated` deixam de ter acesso direto à tabela.

```sql
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.refresh_tokens
  IS 'Tokens de refresh JWT com rotação. TTL 30 dias. RLS habilitado, acessado apenas via service_role.';
```

Após aplicar, rodar de novo `get_advisors` → o lint `rls_disabled_in_public`
some.

## Convenção daqui pra frente

Para evitar acumular novo drift:

1. **Toda nova migration** vai por `apply_migration` (MCP) **OU** SQL Editor
   do Supabase Dashboard, **NUNCA** apenas committada no repo.
2. Nome do arquivo no repo segue o padrão `NN_descricao.sql` (NN sequencial).
3. Após aplicar, rodar `get_advisors` para confirmar que nenhum novo lint
   surgiu.
4. As 37 migrations não rastreadas (01..24, 26..38) ficam como histórico —
   **não retroceder**. O schema do banco já é a verdade. Tentar registrá-las
   tardiamente em `schema_migrations` quebraria a ordenação.

## Referências

- Endpoint Supabase: `https://zesyderishnbjrpfbmqa.supabase.co`
- Region: `us-east-1`, Postgres 17.6
- Cliente admin no servidor: `server/lib/supabase-admin.mjs`
- Regra Cursor: `.cursor/rules/supabase-mcp-agent.mdc`
