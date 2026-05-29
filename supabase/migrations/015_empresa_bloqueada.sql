-- Adiciona coluna bloqueada e motivo_bloqueio na tabela empresas
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS bloqueada BOOLEAN DEFAULT FALSE;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT DEFAULT NULL;

-- Comentario: quando bloqueada = true, usuarios da empresa nao conseguem fazer login
-- A mensagem motivo_bloqueio sera exibida para o usuario
SELECT 'OK' AS resultado;
