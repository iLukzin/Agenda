-- ============================================================
-- RLS SIMPLIFICADO — Qualquer usuário autenticado opera
-- O isolamento por empresa é feito no código da aplicação
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Remove TODAS as políticas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- Aplica política simples: apenas usuário autenticado
-- ============================================================

-- EMPRESAS
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresas_auth" ON empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- USUÁRIOS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios_auth" ON usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CLIENTES
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_auth" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SERVIÇOS
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servicos_auth" ON servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- PLANOS
ALTER TABLE planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos_auth" ON planos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AGENDAMENTOS
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agendamentos_auth" ON agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LANÇAMENTOS
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lancamentos_auth" ON lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- HORÁRIOS
ALTER TABLE horarios_profissional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "horarios_auth" ON horarios_profissional FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BLOQUEIOS
ALTER TABLE bloqueios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bloqueios_auth" ON bloqueios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Confirma resultado
-- ============================================================
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Testa inserção em empresas
INSERT INTO empresas (nome, plano, status)
VALUES ('Teste OK', 'basico', 'ativo')
RETURNING id, nome;

DELETE FROM empresas WHERE nome = 'Teste OK';

SELECT 'RLS configurado com sucesso!' AS resultado;
