-- Habilitar Realtime nas tabelas necessarias
ALTER PUBLICATION supabase_realtime ADD TABLE agendamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE empresas;

-- Verificar
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('agendamentos', 'empresas');
