# AgendaPro — Sistema SaaS de Agenda Multiempresa

Sistema profissional de agenda para clínicas, estúdios e profissionais autônomos.
Construído com **Next.js 14 + Supabase + Tailwind CSS**.

---

## 🚀 Como configurar e rodar

### 1. Pré-requisitos
- Node.js 18+
- Conta gratuita no [Supabase](https://supabase.com)
- Conta gratuita na [Vercel](https://vercel.com) (para deploy)

### 2. Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Vá em **SQL Editor** e execute o arquivo:
   ```
   supabase/migrations/001_schema_inicial.sql
   ```
3. Vá em **Authentication > Settings** e configure:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/dashboard`
4. Copie as credenciais em **Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Instalar e rodar localmente

```bash
# Instalar dependências
npm install

# Criar arquivo de variáveis de ambiente
cp .env.example .env.local
# Preencha com suas credenciais do Supabase

# Rodar em desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

### 4. Criar o primeiro usuário (Admin Master)

1. No Supabase, vá em **Authentication > Users > Add User**
2. Crie um usuário com seu e-mail e senha
3. No SQL Editor, execute:

```sql
INSERT INTO usuarios (auth_id, nome, email, nivel_acesso, empresa_id, status)
VALUES (
  '<UUID_DO_AUTH_CRIADO>',
  'Seu Nome',
  'seu@email.com',
  'master',
  NULL,
  'ativo'
);
```

---

## 📁 Estrutura do projeto

```
agendapro/
├── src/
│   ├── app/
│   │   ├── auth/login/          → Tela de login
│   │   ├── dashboard/
│   │   │   ├── layout.tsx       → Sidebar + layout principal
│   │   │   ├── page.tsx         → Dashboard com métricas
│   │   │   ├── agenda/          → Agenda semanal interativa
│   │   │   ├── clientes/        → Gestão de clientes
│   │   │   ├── servicos/        → Cadastro de serviços
│   │   │   ├── financeiro/      → Módulo financeiro
│   │   │   ├── usuarios/        → Gestão de usuários
│   │   │   └── configuracoes/   → Config da empresa
│   │   └── api/                 → Rotas da API REST
│   ├── components/              → Componentes reutilizáveis
│   ├── lib/supabase.ts          → Cliente Supabase + utilitários
│   └── types/index.ts           → Tipos TypeScript completos
└── supabase/
    └── migrations/
        └── 001_schema_inicial.sql  → Schema completo do banco
```

---

## 🏗️ Módulos implementados

| Módulo | Status | Descrição |
|---|---|---|
| Autenticação | ✅ | Login, JWT, proteção de rotas |
| Multiempresa | ✅ | RLS no Supabase, isolamento total |
| Permissões | ✅ | Master / Admin / Profissional |
| Dashboard | ✅ | Métricas, gráficos, próximos agendamentos |
| Agenda | ✅ | Visualização semanal, criar/editar agendamentos |
| Clientes | ✅ | CRUD completo, busca, filtros, planos |
| Financeiro | ✅ | Lançamentos, fluxo de caixa, relatórios |
| Serviços | 🔧 | Estrutura pronta, UI em desenvolvimento |
| Usuários | 🔧 | Estrutura pronta, UI em desenvolvimento |
| Configurações | 🔧 | Estrutura pronta, UI em desenvolvimento |

---

## 🗃️ Banco de dados (tabelas)

| Tabela | Descrição |
|---|---|
| `empresas` | Cadastro de empresas (tenants) |
| `usuarios` | Usuários com nível de acesso |
| `clientes` | Clientes de cada empresa |
| `servicos` | Serviços oferecidos |
| `planos` | Planos mensais disponíveis |
| `agendamentos` | Agenda com status e histórico |
| `lancamentos` | Financeiro (receitas e despesas) |
| `horarios_profissional` | Grade horária por profissional |
| `bloqueios` | Folgas e indisponibilidades |
| `logs` | Auditoria de todas as ações |

---

## 🔒 Segurança

- **Row Level Security (RLS)** no Supabase — cada empresa só acessa seus dados
- **JWT** para autenticação
- **Senhas criptografadas** pelo Supabase Auth
- **Logs** de todas as ações dos usuários
- **Proteção de rotas** no Next.js middleware

---

## 🚀 Deploy na Vercel

1. Faça push do projeto para o GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em Deploy — pronto!

---

## 📋 Variáveis de ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 🛣️ Próximos passos sugeridos

1. **Completar páginas** de Serviços, Usuários e Configurações
2. **Middleware** de proteção de rotas (verificar sessão)
3. **API Routes** para operações CRUD completas
4. **Drag & drop** na agenda (já tem @dnd-kit instalado)
5. **Notificações** com Sonner (já instalado)
6. **Upload de fotos** de clientes e logo da empresa
7. **Integração PIX** via Asaas ou Mercado Pago
8. **WhatsApp** para confirmação de agendamentos
9. **App mobile** com React Native + Supabase (mesma API)

---

Desenvolvido com ❤️ usando Next.js + Supabase
