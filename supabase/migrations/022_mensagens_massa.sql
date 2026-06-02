CREATE TABLE IF NOT EXISTS campanhas_mensagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT DEFAULT 'agendada',
  agendado_para TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  total_contatos INT DEFAULT 0,
  total_enviado INT DEFAULT 0,
  total_erro INT DEFAULT 0,
  filtro_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE campanhas_mensagem ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campanhas_auth" ON campanhas_mensagem;
CREATE POLICY "campanhas_auth" ON campanhas_mensagem FOR ALL TO authenticated USING (true);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
SELECT 'OK';
