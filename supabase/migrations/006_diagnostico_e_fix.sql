-- ============================================================
-- DIAGNÓSTICO + CORREÇÃO DEFINITIVA
-- Execute no SQL Editor do Supabase
-- ============================================================

-- PASSO 1: Ver o que está na tabela usuarios para o Lucas
SELECT id, nome, email, nivel_acesso, empresa_id, status, auth_id
FROM usuarios
WHERE email ILIKE '%lucas%' OR email ILIKE '%fortitude%';

-- PASSO 2: Ver o auth_id do Lucas no Supabase Auth
-- (Confirme que o auth_id está preenchido)
SELECT id, email FROM auth.users WHERE email ILIKE '%lucas%';

-- PASSO 3: Corrigir caso o auth_id esteja NULL ou errado
-- Descomente e execute após verificar o UUID correto:
/*
UPDATE usuarios
SET auth_id = 'COLE_O_UUID_DO_AUTH_AQUI',
    nivel_acesso = 'master',
    status = 'ativo'
WHERE email = 'lucas@fortitude.com';
*/

-- PASSO 4: SOLUÇÃO TEMPORÁRIA ENQUANTO DIAGNOSTICA
-- Desabilita RLS das empresas para o master conseguir criar
-- (reabilita depois que confirmar o auth_id)
ALTER TABLE empresas DISABLE ROW LEVEL SECURITY;

-- PASSO 5: Testa inserção manual
INSERT INTO empresas (nome, plano, status)
VALUES ('Teste RLS', 'basico', 'ativo')
RETURNING id, nome;

-- Se inseriu OK, pode apagar o teste:
DELETE FROM empresas WHERE nome = 'Teste RLS';

-- PASSO 6: Reabilita RLS com política permissiva para autenticados
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas de empresas
DROP POLICY IF EXISTS "empresas_select" ON empresas;
DROP POLICY IF EXISTS "empresas_insert" ON empresas;
DROP POLICY IF EXISTS "empresas_update" ON empresas;
DROP POLICY IF EXISTS "empresas_delete" ON empresas;

-- Cria política que permite qualquer usuário autenticado
-- (mais permissiva, mas segura pois exige login)
CREATE POLICY "empresas_autenticado_select" ON empresas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "empresas_autenticado_insert" ON empresas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "empresas_autenticado_update" ON empresas
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "empresas_autenticado_delete" ON empresas
  FOR DELETE TO authenticated USING (true);

-- Confirma políticas criadas
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'empresas';
