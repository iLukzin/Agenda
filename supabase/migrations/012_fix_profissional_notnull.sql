-- Remove o NOT NULL de profissional_id (agora usamos prof_id)
ALTER TABLE agendamentos ALTER COLUMN profissional_id DROP NOT NULL;

SELECT 'OK' AS resultado;
