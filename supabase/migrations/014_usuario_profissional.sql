-- Vincula usuarios da tabela usuarios com profissionais
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS profissional_id UUID REFERENCES profissionais(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_profissional ON usuarios(profissional_id);

-- Quando usuario nao tem profissional vinculado e nivel = 'profissional'
-- ele so ve suas proprias agendas (filtro pelo prof_id)
-- Admin e master veem tudo

SELECT 'OK' AS resultado;
