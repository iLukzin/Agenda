-- Adiciona coluna servicos (array de nomes) na tabela profissionais
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS servicos TEXT[] DEFAULT '{}';
SELECT 'OK' AS resultado;
