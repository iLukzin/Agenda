-- Garantir que a policy de empresas permite qualquer autenticado
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_auth" ON empresas;
CREATE POLICY "empresas_auth" ON empresas
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verificar
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'empresas';
