-- Adicionar nivel 'usuario' ao sistema
-- usuario = ve somente suas proprias agendas (profissional vinculado)
-- Atualizar constraint se existir
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_nivel_acesso_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_nivel_acesso_check 
  CHECK (nivel_acesso IN ('master','admin','profissional','usuario'));

SELECT 'OK' AS resultado;
