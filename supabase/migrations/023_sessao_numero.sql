-- Salvar numero da sessao no agendamento para rastreamento correto
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS sessao_numero INT;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS sessao_total INT;
SELECT 'OK';
