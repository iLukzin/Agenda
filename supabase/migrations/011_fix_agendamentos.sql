-- ============================================================
-- CORREÇÃO COMPLETA — Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Remove FK antiga de profissional_id (não mais referencia usuarios)
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_profissional_id_fkey;

-- 2. Adiciona coluna motivo_cancelamento se não existir
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- 3. Adiciona coluna prof_id se não existir
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS prof_id UUID REFERENCES profissionais(id) ON DELETE SET NULL;

-- 4. Remove constraint de status antiga
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;

-- 5. PRIMEIRO migra os dados para os novos valores
UPDATE agendamentos SET status = 'aberto'   WHERE status IN ('agendado','confirmado','em_atendimento','nao_compareceu');
UPDATE agendamentos SET status = 'fechado'  WHERE status = 'finalizado';
-- cancelado já é 'cancelado', não precisa migrar

-- 6. DEPOIS cria a nova constraint com todos os 3 valores
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN ('aberto','fechado','cancelado'));

-- 7. Atualiza o default
ALTER TABLE agendamentos ALTER COLUMN status SET DEFAULT 'aberto';

-- Verifica resultado
SELECT status, COUNT(*) as total FROM agendamentos GROUP BY status;
SELECT 'Migração concluída com sucesso!' AS resultado;
