-- Tabela de planos mensais
CREATE TABLE IF NOT EXISTS planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2) DEFAULT 0,
  sessoes INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vincular plano ao cliente
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES planos(id) ON DELETE SET NULL;

-- Controle de sessões do plano por cliente
CREATE TABLE IF NOT EXISTS cliente_plano_sessoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos(id) ON DELETE CASCADE,
  sessoes_utilizadas INTEGER DEFAULT 0,
  ciclo_inicio TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_plano_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "planos_auth" ON planos FOR ALL TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS "sessoes_auth" ON cliente_plano_sessoes FOR ALL TO authenticated USING (true);

SELECT 'OK' AS resultado;
