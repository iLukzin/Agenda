-- ============================================================
-- CORREÇÃO COMPLETA DO RLS — Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Remover políticas antigas problemáticas
DROP POLICY IF EXISTS "empresa_propria_clientes"     ON clientes;
DROP POLICY IF EXISTS "empresa_propria_servicos"     ON servicos;
DROP POLICY IF EXISTS "empresa_propria_planos"       ON planos;
DROP POLICY IF EXISTS "empresa_propria_agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "empresa_propria_lancamentos"  ON lancamentos;
DROP POLICY IF EXISTS "empresa_propria_usuarios"     ON usuarios;
DROP POLICY IF EXISTS "empresa_propria_bloqueios"    ON bloqueios;
DROP POLICY IF EXISTS "empresa_propria_horarios"     ON horarios_profissional;
DROP POLICY IF EXISTS "master_ve_tudo"               ON empresas;

-- 2. Recriar função auxiliar corretamente
CREATE OR REPLACE FUNCTION minha_empresa_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION meu_nivel_acesso()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT nivel_acesso FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION meu_usuario_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- 3. CLIENTES
-- ============================================================
CREATE POLICY "clientes_select" ON clientes
  FOR SELECT USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "clientes_insert" ON clientes
  FOR INSERT WITH CHECK (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "clientes_update" ON clientes
  FOR UPDATE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "clientes_delete" ON clientes
  FOR DELETE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

-- ============================================================
-- 4. SERVIÇOS
-- ============================================================
CREATE POLICY "servicos_select" ON servicos
  FOR SELECT USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "servicos_insert" ON servicos
  FOR INSERT WITH CHECK (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "servicos_update" ON servicos
  FOR UPDATE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "servicos_delete" ON servicos
  FOR DELETE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

-- ============================================================
-- 5. PLANOS
-- ============================================================
CREATE POLICY "planos_select" ON planos
  FOR SELECT USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "planos_insert" ON planos
  FOR INSERT WITH CHECK (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "planos_update" ON planos
  FOR UPDATE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "planos_delete" ON planos
  FOR DELETE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

-- ============================================================
-- 6. AGENDAMENTOS
-- ============================================================
CREATE POLICY "agendamentos_select" ON agendamentos
  FOR SELECT USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "agendamentos_insert" ON agendamentos
  FOR INSERT WITH CHECK (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "agendamentos_update" ON agendamentos
  FOR UPDATE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "agendamentos_delete" ON agendamentos
  FOR DELETE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

-- ============================================================
-- 7. LANÇAMENTOS
-- ============================================================
CREATE POLICY "lancamentos_select" ON lancamentos
  FOR SELECT USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "lancamentos_insert" ON lancamentos
  FOR INSERT WITH CHECK (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "lancamentos_update" ON lancamentos
  FOR UPDATE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "lancamentos_delete" ON lancamentos
  FOR DELETE USING (
    empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

-- ============================================================
-- 8. USUÁRIOS
-- ============================================================
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (
    id = meu_usuario_id()
    OR empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT WITH CHECK (
    meu_nivel_acesso() IN ('master', 'admin')
  );

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (
    id = meu_usuario_id()
    OR empresa_id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "usuarios_delete" ON usuarios
  FOR DELETE USING (
    meu_nivel_acesso() IN ('master', 'admin')
  );

-- ============================================================
-- 9. EMPRESAS
-- ============================================================
CREATE POLICY "empresas_select" ON empresas
  FOR SELECT USING (
    id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "empresas_insert" ON empresas
  FOR INSERT WITH CHECK (
    meu_nivel_acesso() = 'master'
  );

CREATE POLICY "empresas_update" ON empresas
  FOR UPDATE USING (
    id = minha_empresa_id()
    OR meu_nivel_acesso() = 'master'
  );

CREATE POLICY "empresas_delete" ON empresas
  FOR DELETE USING (
    meu_nivel_acesso() = 'master'
  );

-- ============================================================
-- 10. HORÁRIOS E BLOQUEIOS
-- ============================================================
CREATE POLICY "horarios_select" ON horarios_profissional
  FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

CREATE POLICY "horarios_insert" ON horarios_profissional
  FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

CREATE POLICY "horarios_update" ON horarios_profissional
  FOR UPDATE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

CREATE POLICY "horarios_delete" ON horarios_profissional
  FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

CREATE POLICY "bloqueios_select" ON bloqueios
  FOR SELECT USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

CREATE POLICY "bloqueios_insert" ON bloqueios
  FOR INSERT WITH CHECK (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

CREATE POLICY "bloqueios_delete" ON bloqueios
  FOR DELETE USING (empresa_id = minha_empresa_id() OR meu_nivel_acesso() = 'master');

-- ============================================================
-- 11. Verificar se o usuário master está correto
-- ============================================================
SELECT
  u.nome,
  u.email,
  u.nivel_acesso,
  u.empresa_id,
  u.status,
  u.auth_id IS NOT NULL AS tem_auth
FROM usuarios u
WHERE u.email = 'lucas@fortitude.com';
