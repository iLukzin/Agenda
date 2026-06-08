-- Novas permissões de ações na agenda por usuário
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permitir_cancelar BOOLEAN DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permitir_finalizar BOOLEAN DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permitir_ver_pagamento BOOLEAN DEFAULT TRUE;

-- Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'usuarios'
  AND column_name IN ('permitir_cancelar','permitir_finalizar','permitir_ver_pagamento','profissional_id');
