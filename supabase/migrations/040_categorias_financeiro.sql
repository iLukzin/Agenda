-- Categorias de receita/despesa por empresa (substituem as listas fixas)
CREATE TABLE IF NOT EXISTS categorias_financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_financeiro_empresa ON categorias_financeiro(empresa_id, tipo);

ALTER TABLE categorias_financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categorias_financeiro_auth ON categorias_financeiro;
CREATE POLICY categorias_financeiro_auth ON categorias_financeiro
  FOR ALL USING (true) WITH CHECK (true);

-- Popula categorias padrao para empresas que ja tem o financeiro habilitado,
-- assim quem ja usa o modulo nao fica sem nenhuma categoria
INSERT INTO categorias_financeiro (empresa_id, tipo, nome, ordem)
SELECT e.id, 'receita', cat.nome, cat.ordem
FROM empresas e
CROSS JOIN (VALUES ('Consultas',1),('Avaliações',2),('Planos',3),('Sessões',4),('Outros',5)) AS cat(nome, ordem)
WHERE e.financeiro_habilitado = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO categorias_financeiro (empresa_id, tipo, nome, ordem)
SELECT e.id, 'despesa', cat.nome, cat.ordem
FROM empresas e
CROSS JOIN (VALUES ('Aluguel',1),('Salários',2),('Material',3),('Software',4),('Marketing',5),('Impostos',6),('Manutenção',7),('Outros',8)) AS cat(nome, ordem)
WHERE e.financeiro_habilitado = TRUE
ON CONFLICT DO NOTHING;
