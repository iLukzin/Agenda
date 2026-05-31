ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tipo_agenda TEXT DEFAULT 'grade';
-- 'grade' = visualizacao atual (grade de horarios)
-- 'calendario' = nova visualizacao tipo calendário mensal
SELECT 'OK';
