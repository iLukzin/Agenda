-- ============================================================
-- AgendaPro — Schema PostgreSQL completo
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- EMPRESAS
-- ============================================================
CREATE TABLE empresas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  cnpj          TEXT UNIQUE,
  telefone      TEXT,
  email         TEXT,
  endereco      TEXT,
  cidade        TEXT,
  estado        TEXT,
  cep           TEXT,
  logo_url      TEXT,
  plano         TEXT NOT NULL DEFAULT 'basico' CHECK (plano IN ('basico','profissional','enterprise')),
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','bloqueado')),
  vencimento    DATE,
  configuracoes JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID REFERENCES empresas(id) ON DELETE CASCADE,
  auth_id       UUID UNIQUE, -- Supabase Auth UID
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  telefone      TEXT,
  cargo         TEXT,
  nivel_acesso  TEXT NOT NULL DEFAULT 'profissional'
                  CHECK (nivel_acesso IN ('master','admin','profissional')),
  avatar_url    TEXT,
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICOS
-- ============================================================
CREATE TABLE servicos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  valor         NUMERIC(10,2) NOT NULL DEFAULT 0,
  duracao_min   INTEGER NOT NULL DEFAULT 60, -- duração em minutos
  cor           TEXT DEFAULT '#6366f1',       -- cor na agenda
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Profissionais vinculados a serviços
CREATE TABLE servico_profissionais (
  servico_id    UUID REFERENCES servicos(id) ON DELETE CASCADE,
  usuario_id    UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (servico_id, usuario_id)
);

-- ============================================================
-- PLANOS MENSAIS (definições)
-- ============================================================
CREATE TABLE planos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  valor_mensal  NUMERIC(10,2) NOT NULL DEFAULT 0,
  sessoes_mes   INTEGER,        -- NULL = ilimitado
  validade_dias INTEGER DEFAULT 30,
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENTES
-- ============================================================
CREATE TABLE clientes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  cpf           TEXT,
  telefone      TEXT,
  whatsapp      TEXT,
  email         TEXT,
  endereco      TEXT,
  cidade        TEXT,
  estado        TEXT,
  cep           TEXT,
  data_nascimento DATE,
  foto_url      TEXT,
  observacoes   TEXT,
  plano_id      UUID REFERENCES planos(id),
  plano_inicio  DATE,
  plano_fim     DATE,
  plano_sessoes_usadas INTEGER DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HORÁRIOS DOS PROFISSIONAIS
-- ============================================================
CREATE TABLE horarios_profissional (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  dia_semana    INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
  hora_inicio   TIME NOT NULL,
  hora_fim      TIME NOT NULL,
  intervalo_min INTEGER DEFAULT 0,
  ativo         BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Bloqueios (folgas, férias, feriados)
CREATE TABLE bloqueios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data_inicio   TIMESTAMPTZ NOT NULL,
  data_fim      TIMESTAMPTZ NOT NULL,
  motivo        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGENDAMENTOS
-- ============================================================
CREATE TABLE agendamentos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id    UUID NOT NULL REFERENCES clientes(id),
  servico_id    UUID NOT NULL REFERENCES servicos(id),
  profissional_id UUID NOT NULL REFERENCES usuarios(id),
  data_inicio   TIMESTAMPTZ NOT NULL,
  data_fim      TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'agendado'
                  CHECK (status IN ('agendado','confirmado','em_atendimento','finalizado','cancelado','nao_compareceu')),
  tipo_cobranca TEXT NOT NULL DEFAULT 'avulso' CHECK (tipo_cobranca IN ('avulso','plano')),
  valor         NUMERIC(10,2),
  forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro','cartao_credito','cartao_debito','pix','transferencia','plano')),
  observacoes   TEXT,
  recorrente    BOOLEAN DEFAULT FALSE,
  recorrencia_id UUID, -- agrupa agendamentos recorrentes
  created_by    UUID REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCEIRO
-- ============================================================
CREATE TABLE lancamentos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  descricao     TEXT NOT NULL,
  valor         NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  status        TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  categoria     TEXT,
  agendamento_id UUID REFERENCES agendamentos(id),
  cliente_id    UUID REFERENCES clientes(id),
  forma_pagamento TEXT,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LOGS DE AÇÕES
-- ============================================================
CREATE TABLE logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID REFERENCES empresas(id),
  usuario_id    UUID REFERENCES usuarios(id),
  acao          TEXT NOT NULL,
  tabela        TEXT,
  registro_id   UUID,
  detalhes      JSONB,
  ip            TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_agendamentos_empresa    ON agendamentos(empresa_id);
CREATE INDEX idx_agendamentos_profissional ON agendamentos(profissional_id);
CREATE INDEX idx_agendamentos_cliente    ON agendamentos(cliente_id);
CREATE INDEX idx_agendamentos_data       ON agendamentos(data_inicio);
CREATE INDEX idx_agendamentos_status     ON agendamentos(status);
CREATE INDEX idx_clientes_empresa        ON clientes(empresa_id);
CREATE INDEX idx_lancamentos_empresa     ON lancamentos(empresa_id);
CREATE INDEX idx_lancamentos_data        ON lancamentos(data_vencimento);
CREATE INDEX idx_usuarios_empresa        ON usuarios(empresa_id);
CREATE INDEX idx_usuarios_auth           ON usuarios(auth_id);

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_empresas_updated_at   BEFORE UPDATE ON empresas   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_usuarios_updated_at   BEFORE UPDATE ON usuarios   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clientes_updated_at   BEFORE UPDATE ON clientes   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_servicos_updated_at   BEFORE UPDATE ON servicos   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_agendamentos_updated_at BEFORE UPDATE ON agendamentos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lancamentos_updated_at BEFORE UPDATE ON lancamentos FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Isolamento multiempresa
-- ============================================================
ALTER TABLE empresas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_profissional ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: retorna empresa_id do usuário logado
CREATE OR REPLACE FUNCTION minha_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Função auxiliar: retorna nível de acesso do usuário logado
CREATE OR REPLACE FUNCTION meu_nivel_acesso()
RETURNS TEXT AS $$
  SELECT nivel_acesso FROM usuarios WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas: usuários só veem dados da própria empresa
CREATE POLICY "empresa_propria_clientes"    ON clientes         FOR ALL USING (empresa_id = minha_empresa_id());
CREATE POLICY "empresa_propria_servicos"    ON servicos         FOR ALL USING (empresa_id = minha_empresa_id());
CREATE POLICY "empresa_propria_planos"      ON planos           FOR ALL USING (empresa_id = minha_empresa_id());
CREATE POLICY "empresa_propria_agendamentos" ON agendamentos    FOR ALL USING (empresa_id = minha_empresa_id());
CREATE POLICY "empresa_propria_lancamentos" ON lancamentos      FOR ALL USING (empresa_id = minha_empresa_id());
CREATE POLICY "empresa_propria_usuarios"    ON usuarios         FOR ALL USING (empresa_id = minha_empresa_id() OR nivel_acesso = 'master');
CREATE POLICY "empresa_propria_bloqueios"   ON bloqueios        FOR ALL USING (empresa_id = minha_empresa_id());
CREATE POLICY "empresa_propria_horarios"    ON horarios_profissional FOR ALL USING (empresa_id = minha_empresa_id());

-- Master vê todas as empresas
CREATE POLICY "master_ve_tudo" ON empresas FOR ALL USING (
  meu_nivel_acesso() = 'master' OR id = minha_empresa_id()
);

-- ============================================================
-- DADOS INICIAIS (seed)
-- ============================================================

-- Empresa demo
INSERT INTO empresas (id, nome, cnpj, email, telefone, plano, status, vencimento)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Studio Demo',
  '00.000.000/0001-00',
  'demo@agendapro.com.br',
  '(11) 99999-9999',
  'profissional',
  'ativo',
  NOW() + INTERVAL '1 year'
);

-- Serviços demo
INSERT INTO servicos (empresa_id, nome, descricao, valor, duracao_min, cor) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Consulta',         'Consulta padrão',       150.00, 60,  '#6366f1'),
  ('00000000-0000-0000-0000-000000000001', 'Retorno',          'Consulta de retorno',    80.00, 30,  '#8b5cf6'),
  ('00000000-0000-0000-0000-000000000001', 'Avaliação',        'Avaliação completa',    200.00, 90,  '#06b6d4'),
  ('00000000-0000-0000-0000-000000000001', 'Sessão Terapêutica','Sessão terapêutica',   120.00, 50,  '#10b981');

-- Planos demo
INSERT INTO planos (empresa_id, nome, descricao, valor_mensal, sessoes_mes) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Plano 4 sessões',  '4 sessões por mês',  400.00, 4),
  ('00000000-0000-0000-0000-000000000001', 'Plano 8 sessões',  '8 sessões por mês',  720.00, 8),
  ('00000000-0000-0000-0000-000000000001', 'Plano Ilimitado',  'Sessões ilimitadas', 990.00, NULL);
