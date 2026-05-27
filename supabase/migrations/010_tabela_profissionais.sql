-- ============================================================
-- Tabela própria de profissionais (funcionários da empresa)
-- Separada de usuários do sistema
-- ============================================================

CREATE TABLE IF NOT EXISTS profissionais (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  email        TEXT,
  telefone     TEXT,
  cargo        TEXT,
  especialidade TEXT,
  cor          TEXT NOT NULL DEFAULT '#6366f1',
  status       TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profissionais_empresa ON profissionais(empresa_id);

-- Tabela de horários do profissional (sem FK para usuarios)
CREATE TABLE IF NOT EXISTS horarios_prof (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  empresa_id   UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  dia_semana   INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio  TEXT NOT NULL DEFAULT '08:00',
  hora_fim     TEXT NOT NULL DEFAULT '18:00',
  ativo        BOOLEAN DEFAULT TRUE,
  UNIQUE(profissional_id, dia_semana)
);

CREATE INDEX IF NOT EXISTS idx_horarios_prof_prof ON horarios_prof(profissional_id);

-- Habilita RLS
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_prof ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profissionais_auth" ON profissionais;
DROP POLICY IF EXISTS "horarios_prof_auth" ON horarios_prof;

CREATE POLICY "profissionais_auth" ON profissionais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "horarios_prof_auth" ON horarios_prof FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER trg_profissionais_updated_at
  BEFORE UPDATE ON profissionais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Altera agendamentos para referenciar profissionais (nova FK opcional)
ALTER TABLE agendamentos 
  ADD COLUMN IF NOT EXISTS prof_id UUID REFERENCES profissionais(id) ON DELETE SET NULL;

SELECT 'Tabela profissionais criada!' AS resultado;
