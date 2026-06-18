-- Flag para habilitar/desabilitar o modulo financeiro por empresa
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS financeiro_habilitado BOOLEAN DEFAULT FALSE;

-- Garantir colunas necessarias na tabela lancamentos para o fluxo de contas a pagar/receber
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cliente_id UUID;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual';
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS criado_por UUID;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS observacoes TEXT;

CREATE INDEX IF NOT EXISTS idx_lancamentos_empresa_venc ON lancamentos(empresa_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_empresa_status ON lancamentos(empresa_id, status);
