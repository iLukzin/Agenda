-- ============================================================
-- Tabelas novas com DROP IF EXISTS nas políticas
-- Execute no SQL Editor do Supabase
-- ============================================================

-- STATUS DE AGENDAMENTO
CREATE TABLE IF NOT EXISTS status_agendamento (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  cor        TEXT NOT NULL DEFAULT '#6366f1',
  icone      TEXT NOT NULL DEFAULT '📅',
  ordem      INTEGER NOT NULL DEFAULT 1,
  padrao     BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_empresa ON status_agendamento(empresa_id);
ALTER TABLE status_agendamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "status_auth" ON status_agendamento;
CREATE POLICY "status_auth" ON status_agendamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PERMISSÕES DE USUÁRIO
CREATE TABLE IF NOT EXISTS permissoes_usuario (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tela         TEXT NOT NULL,
  visualizar   BOOLEAN DEFAULT TRUE,
  criar        BOOLEAN DEFAULT FALSE,
  alterar      BOOLEAN DEFAULT FALSE,
  excluir      BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, tela)
);
CREATE INDEX IF NOT EXISTS idx_perm_usuario ON permissoes_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_perm_empresa ON permissoes_usuario(empresa_id);
ALTER TABLE permissoes_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissoes_auth" ON permissoes_usuario;
CREATE POLICY "permissoes_auth" ON permissoes_usuario FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'Tabelas criadas com sucesso!' AS resultado;
