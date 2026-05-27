-- ============================================================
-- CORREÇÃO: Master consegue inserir empresas e usuários
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Remove todas as políticas existentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('clientes','servicos','planos','agendamentos',
                      'lancamentos','usuarios','empresas',
                      'horarios_profissional','bloqueios')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 2. Recria funções auxiliares corrigidas
-- Retorna empresa_id do usuário logado
CREATE OR REPLACE FUNCTION minha_empresa_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Retorna nível de acesso — NULL-safe: se não achar retorna 'none'
CREATE OR REPLACE FUNCTION meu_nivel_acesso()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(nivel_acesso, 'none')
  FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Retorna id do usuário logado na tabela usuarios
CREATE OR REPLACE FUNCTION meu_usuario_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Verifica se é master (simplifica as políticas)
CREATE OR REPLACE FUNCTION eh_master()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE auth_id = auth.uid() AND nivel_acesso = 'master'
  );
$$;

-- ============================================================
-- 3. EMPRESAS — master pode fazer tudo
-- ============================================================
CREATE POLICY "empresas_select" ON empresas
  FOR SELECT USING (
    eh_master() OR id = minha_empresa_id()
  );

CREATE POLICY "empresas_insert" ON empresas
  FOR INSERT WITH CHECK (
    eh_master()
  );

CREATE POLICY "empresas_update" ON empresas
  FOR UPDATE USING (
    eh_master() OR id = minha_empresa_id()
  );

CREATE POLICY "empresas_delete" ON empresas
  FOR DELETE USING (
    eh_master()
  );

-- ============================================================
-- 4. USUÁRIOS — master pode fazer tudo; admin gerencia sua empresa
-- ============================================================
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (
    eh_master()
    OR id = meu_usuario_id()
    OR empresa_id = minha_empresa_id()
  );

CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT WITH CHECK (
    eh_master()
    OR meu_nivel_acesso() = 'admin'
  );

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (
    eh_master()
    OR id = meu_usuario_id()
    OR empresa_id = minha_empresa_id()
  );

CREATE POLICY "usuarios_delete" ON usuarios
  FOR DELETE USING (
    eh_master()
    OR meu_nivel_acesso() = 'admin'
  );

-- ============================================================
-- 5. CLIENTES
-- ============================================================
CREATE POLICY "clientes_select" ON clientes
  FOR SELECT USING (
    eh_master() OR empresa_id = minha_empresa_id()
  );
CREATE POLICY "clientes_insert" ON clientes
  FOR INSERT WITH CHECK (
    eh_master() OR empresa_id = minha_empresa_id()
  );
CREATE POLICY "clientes_update" ON clientes
  FOR UPDATE USING (
    eh_master() OR empresa_id = minha_empresa_id()
  );
CREATE POLICY "clientes_delete" ON clientes
  FOR DELETE USING (
    eh_master() OR empresa_id = minha_empresa_id()
  );

-- ============================================================
-- 6. SERVIÇOS
-- ============================================================
CREATE POLICY "servicos_select" ON servicos
  FOR SELECT USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "servicos_insert" ON servicos
  FOR INSERT WITH CHECK (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "servicos_update" ON servicos
  FOR UPDATE USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "servicos_delete" ON servicos
  FOR DELETE USING (eh_master() OR empresa_id = minha_empresa_id());

-- ============================================================
-- 7. PLANOS
-- ============================================================
CREATE POLICY "planos_select" ON planos
  FOR SELECT USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "planos_insert" ON planos
  FOR INSERT WITH CHECK (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "planos_update" ON planos
  FOR UPDATE USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "planos_delete" ON planos
  FOR DELETE USING (eh_master() OR empresa_id = minha_empresa_id());

-- ============================================================
-- 8. AGENDAMENTOS
-- ============================================================
CREATE POLICY "agendamentos_select" ON agendamentos
  FOR SELECT USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "agendamentos_insert" ON agendamentos
  FOR INSERT WITH CHECK (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "agendamentos_update" ON agendamentos
  FOR UPDATE USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "agendamentos_delete" ON agendamentos
  FOR DELETE USING (eh_master() OR empresa_id = minha_empresa_id());

-- ============================================================
-- 9. LANÇAMENTOS
-- ============================================================
CREATE POLICY "lancamentos_select" ON lancamentos
  FOR SELECT USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "lancamentos_insert" ON lancamentos
  FOR INSERT WITH CHECK (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "lancamentos_update" ON lancamentos
  FOR UPDATE USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "lancamentos_delete" ON lancamentos
  FOR DELETE USING (eh_master() OR empresa_id = minha_empresa_id());

-- ============================================================
-- 10. HORÁRIOS
-- ============================================================
CREATE POLICY "horarios_select" ON horarios_profissional
  FOR SELECT USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "horarios_insert" ON horarios_profissional
  FOR INSERT WITH CHECK (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "horarios_update" ON horarios_profissional
  FOR UPDATE USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "horarios_delete" ON horarios_profissional
  FOR DELETE USING (eh_master() OR empresa_id = minha_empresa_id());

-- ============================================================
-- 11. BLOQUEIOS
-- ============================================================
CREATE POLICY "bloqueios_select" ON bloqueios
  FOR SELECT USING (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "bloqueios_insert" ON bloqueios
  FOR INSERT WITH CHECK (eh_master() OR empresa_id = minha_empresa_id());
CREATE POLICY "bloqueios_delete" ON bloqueios
  FOR DELETE USING (eh_master() OR empresa_id = minha_empresa_id());

-- ============================================================
-- 12. Verifica resultado final
-- ============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Teste: confirma que o lucas está como master
SELECT id, nome, email, nivel_acesso, empresa_id, status
FROM usuarios
WHERE email = 'lucas@fortitude.com';
