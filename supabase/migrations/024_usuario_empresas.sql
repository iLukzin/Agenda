-- Tabela de vínculo de usuários com múltiplas empresas
CREATE TABLE IF NOT EXISTS usuario_empresas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, empresa_id)
);

ALTER TABLE usuario_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario_empresas_auth" ON usuario_empresas FOR ALL TO authenticated USING (true);

-- Popular com vínculos existentes (usuários que já têm empresa_id)
INSERT INTO usuario_empresas (usuario_id, empresa_id)
SELECT id, empresa_id FROM usuarios
WHERE empresa_id IS NOT NULL
ON CONFLICT DO NOTHING;
