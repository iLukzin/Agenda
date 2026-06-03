-- Log detalhado de envio por destinatário
CREATE TABLE IF NOT EXISTS campanha_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas_mensagem(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id  UUID REFERENCES clientes(id) ON DELETE SET NULL,
  nome        TEXT,
  numero      TEXT NOT NULL,
  mensagem    TEXT,
  status      TEXT NOT NULL DEFAULT 'enviado', -- 'enviado' | 'erro'
  erro_msg    TEXT,
  enviado_em  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE campanha_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campanha_log_auth" ON campanha_log FOR ALL TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS campanha_log_campanha_idx ON campanha_log(campanha_id);

-- Colunas extras na campanha (caso ainda não existam)
ALTER TABLE campanhas_mensagem ADD COLUMN IF NOT EXISTS envio_automatico BOOLEAN DEFAULT FALSE;
ALTER TABLE campanhas_mensagem ADD COLUMN IF NOT EXISTS clientes_ids UUID[];
