-- Remover vínculos em usuario_empresas que apontam para empresas inexistentes
DELETE FROM usuario_empresas
WHERE empresa_id NOT IN (SELECT id FROM empresas);

-- Remover vínculos de usuários inexistentes  
DELETE FROM usuario_empresas
WHERE usuario_id NOT IN (SELECT id FROM usuarios);

-- Verificar vínculos válidos restantes
SELECT ue.usuario_id, u.nome, ue.empresa_id, e.nome as empresa
FROM usuario_empresas ue
JOIN usuarios u ON u.id = ue.usuario_id
JOIN empresas e ON e.id = ue.empresa_id
ORDER BY u.nome, e.nome;
