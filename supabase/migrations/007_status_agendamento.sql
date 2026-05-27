-- Tabela de status personalizados por empresa
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
CREATE POLICY "status_auth" ON status_agendamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
