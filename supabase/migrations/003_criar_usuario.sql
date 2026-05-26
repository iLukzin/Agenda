-- ============================================================
-- Como criar um novo usuário no sistema
-- Execute no SQL Editor do Supabase
-- ============================================================

-- PASSO 1: Crie o login do usuário em Authentication → Users → Add User
--   E-mail: usuario@empresa.com
--   Senha: (escolha uma senha)
--   IMPORTANTE: desative "Confirm email" em Auth → Providers → Email

-- PASSO 2: Copie o UUID gerado e use o script abaixo

-- Exemplo: criar um Administrador vinculado a uma empresa
INSERT INTO usuarios (auth_id, nome, email, telefone, cargo, nivel_acesso, empresa_id, status)
VALUES (
  'UUID_DO_AUTH_AQUI',         -- ← UUID do Supabase Auth
  'Nome do Usuário',
  'usuario@empresa.com',
  '(11) 99999-0000',
  'Cargo do usuário',
  'admin',                     -- 'master' | 'admin' | 'profissional'
  'ID_DA_EMPRESA_AQUI',        -- ← ID da empresa na tabela empresas (NULL para master)
  'ativo'
);

-- ============================================================
-- Verificar usuários cadastrados
-- ============================================================
SELECT u.nome, u.email, u.nivel_acesso, u.status, e.nome AS empresa
FROM usuarios u
LEFT JOIN empresas e ON e.id = u.empresa_id
ORDER BY u.nivel_acesso, u.nome;

-- ============================================================
-- Inativar um usuário
-- ============================================================
UPDATE usuarios SET status = 'inativo' WHERE email = 'usuario@empresa.com';

-- ============================================================
-- Reativar um usuário
-- ============================================================
UPDATE usuarios SET status = 'ativo' WHERE email = 'usuario@empresa.com';

-- ============================================================
-- Excluir um usuário (também remova do Auth manualmente)
-- ============================================================
DELETE FROM usuarios WHERE email = 'usuario@empresa.com';
-- Depois vá em Authentication → Users e exclua o login também
