-- IMPORTANTE: Execute este SQL no Supabase para habilitar Realtime
-- Dashboard Supabase -> Database -> Replication -> Tables

-- Habilitar realtime na tabela agendamentos
ALTER PUBLICATION supabase_realtime ADD TABLE agendamentos;

-- Verificar se foi habilitado
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'agendamentos';
