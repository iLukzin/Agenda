-- ============================================================
-- CORREÇÃO COMPLETA DO RLS
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Remove TODAS as políticas existentes de cada tabela
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('clientes','servicos','planos','agendamentos','lancamentos','usuarios','empresas','horarios_profissional','bloqueios')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- Recria funções auxiliares
-- ============================================================
CREATE OR REPLACE FUNCTION minha_empresa_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION meu_nivel_acesso()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT nivel_acesso FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION meu_usuario_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "clientes_delete" ON clientes FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- SERVIÇOS
-- ============================================================
CREATE POLICY "servicos_select" ON servicos FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "servicos_insert" ON servicos FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "servicos_update" ON servicos FOR UPDATE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "servicos_delete" ON servicos FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- PLANOS
-- ============================================================
CREATE POLICY "planos_select" ON planos FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "planos_insert" ON planos FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "planos_update" ON planos FOR UPDATE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "planos_delete" ON planos FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- AGENDAMENTOS
-- ============================================================
CREATE POLICY "agendamentos_select" ON agendamentos FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "agendamentos_insert" ON agendamentos FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "agendamentos_update" ON agendamentos FOR UPDATE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "agendamentos_delete" ON agendamentos FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- LANÇAMENTOS
-- ============================================================
CREATE POLICY "lancamentos_select" ON lancamentos FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "lancamentos_insert" ON lancamentos FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "lancamentos_update" ON lancamentos FOR UPDATE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "lancamentos_delete" ON lancamentos FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- USUÁRIOS
-- ============================================================
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT USING (id = meu_usuario_id() OR empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT WITH CHECK (meu_nivel_acesso() IN ('master','admin'));
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE USING (id = meu_usuario_id() OR empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE USING (meu_nivel_acesso() IN ('master','admin'));

-- ============================================================
-- EMPRESAS
-- ============================================================
CREATE POLICY "empresas_select" ON empresas FOR SELECT USING (id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "empresas_insert" ON empresas FOR INSERT WITH CHECK (meu_nivel_acesso() = 'master');
CREATE POLICY "empresas_update" ON empresas FOR UPDATE USING (id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "empresas_delete" ON empresas FOR DELETE USING (meu_nivel_acesso() = 'master');

-- ============================================================
-- HORÁRIOS
-- ============================================================
CREATE POLICY "horarios_select" ON horarios_profissional FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "horarios_insert" ON horarios_profissional FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "horarios_update" ON horarios_profissional FOR UPDATE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "horarios_delete" ON horarios_profissional FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- BLOQUEIOS
-- ============================================================
CREATE POLICY "bloqueios_select" ON bloqueios FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "bloqueios_insert" ON bloqueios FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');
CREATE POLICY "bloqueios_delete" ON bloqueios FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- Verifica resultado
-- ============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
