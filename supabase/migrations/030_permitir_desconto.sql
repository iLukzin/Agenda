-- Flag para permitir aplicar desconto no agendamento
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permitir_desconto BOOLEAN DEFAULT FALSE;
