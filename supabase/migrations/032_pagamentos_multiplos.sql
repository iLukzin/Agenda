-- Campo pagamentos multiplos
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS pagamentos TEXT DEFAULT NULL;
