-- Garantir que todos os usuários com empresa_id têm vínculo em usuario_empresas
INSERT INTO usuario_empresas (usuario_id, empresa_id)
SELECT u.id, u.empresa_id
FROM usuarios u
WHERE u.empresa_id IS NOT NULL
  AND u.nivel_acesso != 'master'
ON CONFLICT (usuario_id, empresa_id) DO NOTHING;

-- Verificar resultado
SELECT 
  u.nome as usuario,
  e.nome as empresa,
  'vinculo' as tipo
FROM usuario_empresas ue
JOIN usuarios u ON u.id = ue.usuario_id
JOIN empresas e ON e.id = ue.empresa_id
ORDER BY u.nome, e.nome;
