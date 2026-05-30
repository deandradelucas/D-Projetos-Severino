-- Aprendiz da Agenda: log de extrações, propostas de melhoria, regras ativas

CREATE TABLE IF NOT EXISTS agenda_title_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  transcricao text NOT NULL,
  titulo_gerado text NOT NULL,
  fonte text NOT NULL CHECK (fonte IN ('gemini', 'grok', 'heuristico')),
  qualidade_score numeric(3,2) CHECK (qualidade_score BETWEEN 0 AND 1),
  usuario_editou boolean DEFAULT false NOT NULL,
  titulo_editado text,
  flags text[],
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS agenda_learning_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agente text NOT NULL DEFAULT '@aprendizdaagenda',
  alteracao_titulo text NOT NULL,
  alteracao_descricao text NOT NULL,
  alteracao_tipo text NOT NULL CHECK (alteracao_tipo IN ('prompt_regra', 'regex_heuristica', 'exemplo_treinamento')),
  alteracao_conteudo jsonb NOT NULL DEFAULT '{}',
  exemplos_ruins jsonb DEFAULT '[]',
  aprovacao boolean,
  revisado_em timestamptz,
  revisado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  aplicado boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS agenda_learned_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid REFERENCES agenda_learning_proposals(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  regra_texto text NOT NULL,
  ativo boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_title_log_usuario ON agenda_title_log (usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_title_log_qualidade ON agenda_title_log (qualidade_score, usuario_editou) WHERE qualidade_score < 0.5 OR usuario_editou = true;
CREATE INDEX IF NOT EXISTS idx_proposals_aprovacao ON agenda_learning_proposals (aprovacao, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learned_rules_ativo ON agenda_learned_rules (ativo) WHERE ativo = true;
