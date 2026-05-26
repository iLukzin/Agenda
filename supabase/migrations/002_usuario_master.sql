-- ============================================================
-- Configura lucas@fortitude.com como usuário MASTER
-- Execute APÓS criar o usuário no Supabase Auth
-- ============================================================

-- PASSO 1: Crie o usuário no Supabase em:
--   Authentication → Users → Add User
--   E-mail: lucas@fortitude.com
--   Senha: (escolha uma senha segura)

-- PASSO 2: Copie o UUID gerado e cole abaixo no lugar de SEU_UUID_AQUI

-- PASSO 3: Execute este script no SQL Editor

INSERT INTO usuarios (
  auth_id,
  nome,
  email,
  nivel_acesso,
  empresa_id,
  status
)
VALUES (
  'SEU_UUID_AQUI',   -- ← Cole aqui o UUID do Supabase Auth
  'Lucas Fortitude',
  'lucas@fortitude.com',
  'master',
  NULL,              -- Master não pertence a nenhuma empresa específica
  'ativo'
)
ON CONFLICT (email) DO UPDATE
  SET nivel_acesso = 'master',
      auth_id = EXCLUDED.auth_id,
      status = 'ativo';

-- ============================================================
-- Verificar se foi criado corretamente
-- ============================================================
SELECT id, nome, email, nivel_acesso, status
FROM usuarios
WHERE email = 'lucas@fortitude.com';
