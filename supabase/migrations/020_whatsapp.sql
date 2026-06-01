-- Configuracao WhatsApp por empresa
ALTER TABLE empresas 
  ADD COLUMN IF NOT EXISTS whatsapp_api_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_api_token TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_instancia TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_ativo BOOLEAN DEFAULT FALSE;

-- Templates de mensagens
CREATE TABLE IF NOT EXISTS mensagens_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'confirmacao' | 'aniversario' | 'massa'
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mensagens_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_template_auth" ON mensagens_template;
CREATE POLICY "msg_template_auth" ON mensagens_template FOR ALL TO authenticated USING (true);

-- Log de envios
CREATE TABLE IF NOT EXISTS mensagens_enviadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  agendamento_id UUID,
  tipo TEXT,
  numero TEXT,
  mensagem TEXT,
  status TEXT DEFAULT 'enviado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mensagens_enviadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_enviadas_auth" ON mensagens_enviadas;
CREATE POLICY "msg_enviadas_auth" ON mensagens_enviadas FOR ALL TO authenticated USING (true);

SELECT 'OK' AS resultado;

-- Colunas de automacao
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS wpp_auto_confirmacao BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS wpp_auto_aniversario BOOLEAN DEFAULT FALSE;

-- Configuracao global da Evolution API (gerenciada pelo master)
CREATE TABLE IF NOT EXISTS config_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE config_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_sistema_auth" ON config_sistema;
CREATE POLICY "config_sistema_auth" ON config_sistema FOR ALL TO authenticated USING (true);

-- Inserir config inicial
INSERT INTO config_sistema (chave, valor) VALUES
  ('evolution_api_url', ''),
  ('evolution_api_key', '')
ON CONFLICT (chave) DO NOTHING;
