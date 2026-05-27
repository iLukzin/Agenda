-- Tabela de permissões por usuário e tela
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
CREATE POLICY "permissoes_auth" ON permissoes_usuario FOR ALL TO authenticated USING (true) WITH CHECK (true);
