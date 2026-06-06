-- Flag por usuário para bloquear edição de valor no agendamento
-- Padrão TRUE = bloqueado (não pode alterar o valor)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloquear_edicao_valor BOOLEAN DEFAULT TRUE;

-- Remover coluna da tabela empresas se existir (migrada para usuários)
ALTER TABLE empresas DROP COLUMN IF EXISTS bloquear_edicao_valor;
