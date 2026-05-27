-- ============================================================
-- CORREÇÃO: Agendamentos usar profissionais em vez de usuarios
-- Simplificação de status: apenas 'aberto' e 'fechado'
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Remove FK antiga de profissional_id
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_profissional_id_fkey;

-- 2. Adiciona coluna motivo_cancelamento
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- 3. Deixa profissional_id como UUID livre (sem FK para usuarios)
-- e usa prof_id como FK para a nova tabela profissionais
-- profissional_id agora vai receber o ID de profissionais

-- 4. Remove check constraint de status antiga e cria nova simplificada
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;
ALTER TABLE agendamentos 
  ADD CONSTRAINT agendamentos_status_check 
  CHECK (status IN ('aberto','fechado','cancelado'));

-- 5. Atualiza status antigos para o novo padrão
UPDATE agendamentos SET status = 'aberto'  WHERE status IN ('agendado','confirmado','em_atendimento','nao_compareceu');
UPDATE agendamentos SET status = 'fechado' WHERE status = 'finalizado';
-- cancelado já é 'cancelado', mantém

-- 6. Altera default
ALTER TABLE agendamentos ALTER COLUMN status SET DEFAULT 'aberto';

-- 7. Garante que prof_id exista
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS prof_id UUID REFERENCES profissionais(id) ON DELETE SET NULL;

-- Verifica
SELECT status, COUNT(*) FROM agendamentos GROUP BY status;
SELECT 'OK!' AS resultado;
