-- Flag para permitir aplicar desconto no agendamento
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permitir_desconto BOOLEAN DEFAULT FALSE;

-- Verificar colunas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name IN ('bloquear_edicao_valor', 'permitir_desconto');
