-- Flag na empresa para habilitar AutoAgenda
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS auto_agenda_habilitado BOOLEAN DEFAULT FALSE;

-- Tabela de configuração de AutoAgenda por cliente
CREATE TABLE IF NOT EXISTS auto_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES profissionais(id) ON DELETE SET NULL,
  servico_id UUID REFERENCES servicos(id) ON DELETE SET NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=dom, 1=seg, ..., 6=sab
  horario TIME NOT NULL, -- ex: '10:00:00'
  ativo BOOLEAN DEFAULT TRUE,
  criado_at TIMESTAMPTZ DEFAULT now(),
  atualizado_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, cliente_id, dia_semana, horario)
);

CREATE INDEX IF NOT EXISTS idx_auto_agenda_empresa ON auto_agenda(empresa_id);
CREATE INDEX IF NOT EXISTS idx_auto_agenda_cliente ON auto_agenda(cliente_id);
CREATE INDEX IF NOT EXISTS idx_auto_agenda_ativo ON auto_agenda(ativo) WHERE ativo = TRUE;

ALTER TABLE auto_agenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auto_agenda_auth ON auto_agenda;
CREATE POLICY auto_agenda_auth ON auto_agenda FOR ALL USING (true) WITH CHECK (true);

-- Log de execução do cron de AutoAgenda (para evitar duplicatas)
CREATE TABLE IF NOT EXISTS auto_agenda_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_agenda_id UUID NOT NULL REFERENCES auto_agenda(id) ON DELETE CASCADE,
  agendamento_id UUID,
  data_agendada DATE NOT NULL,
  criado_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(auto_agenda_id, data_agendada)
);

CREATE INDEX IF NOT EXISTS idx_auto_agenda_log_id ON auto_agenda_log(auto_agenda_id);
CREATE INDEX IF NOT EXISTS idx_auto_agenda_log_data ON auto_agenda_log(data_agendada);

ALTER TABLE auto_agenda_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auto_agenda_log_auth ON auto_agenda_log;
CREATE POLICY auto_agenda_log_auth ON auto_agenda_log FOR ALL USING (true) WITH CHECK (true);

-- Flag para finalizar agendamento sem exigir forma de pagamento
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS finalizar_sem_pagamento BOOLEAN DEFAULT FALSE;

-- Intervalo padrão de atendimento por profissional (15, 30 ou 60 min)
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS intervalo_atendimento INTEGER DEFAULT 30;

-- Trial de 3 dias para empresas criadas pelo cadastro rápido
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS data_expiracao_trial TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

-- Tipo de agenda padrão timeline, financeiro habilitado
-- (já aplicado na API de cadastro rápido, aqui só documenta)

-- Armazenar múltiplos serviços por agendamento
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS servicos_json JSONB DEFAULT NULL;
