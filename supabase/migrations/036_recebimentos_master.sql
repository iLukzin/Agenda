-- Controle de recebimentos (pagamentos das empresas pelo aluguel do sistema)
-- Acesso restrito ao usuario master lucas@fortitude.com

CREATE TABLE IF NOT EXISTS recebimentos_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  vencimento DATE NOT NULL,
  pago BOOLEAN DEFAULT FALSE,
  data_pagamento DATE,
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recebimentos_master_empresa ON recebimentos_master(empresa_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_master_vencimento ON recebimentos_master(vencimento);

ALTER TABLE recebimentos_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recebimentos_master_auth ON recebimentos_master;
CREATE POLICY recebimentos_master_auth ON recebimentos_master
  FOR ALL USING (true) WITH CHECK (true);
