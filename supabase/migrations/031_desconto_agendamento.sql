-- Colunas de desconto no agendamento
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(10,2) DEFAULT NULL;

-- Preencher valor_bruto para agendamentos existentes (valor_bruto = valor quando nao tem desconto)
UPDATE agendamentos SET valor_bruto = valor WHERE valor_bruto IS NULL;
