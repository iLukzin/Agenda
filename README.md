# AgendaPro — Sistema SaaS de Agenda Multiempresa

Sistema profissional de agenda para clínicas, estúdios e profissionais autônomos.
Construído com **Next.js 14 + Supabase + Tailwind CSS**.

---

## 🗂 Estrutura de pastas

```
agendapro/
├── src/
│   ├── app/
│   │   ├── page.tsx                        → Redireciona para /auth/login
│   │   ├── layout.tsx                      → Layout raiz + Provider
│   │   ├── globals.css                     → Estilos globais
│   │   ├── auth/
│   │   │   └── login/page.tsx              → Tela de login
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                  → Sidebar + topbar responsiva
│   │   │   ├── page.tsx                    → Dashboard com métricas
│   │   │   ├── agenda/page.tsx             → Agenda semanal/dia/período
│   │   │   ├── clientes/page.tsx           → Gestão de clientes
│   │   │   ├── profissionais/page.tsx      → Gestão de profissionais
│   │   │   ├── servicos/page.tsx           → Cadastro de serviços
│   │   │   ├── financeiro/page.tsx         → Módulo financeiro
│   │   │   ├── usuarios/page.tsx           → Gestão de usuários
│   │   │   └── configuracoes/page.tsx      → Configurações da empresa
│   │   └── master/
│   │       ├── layout.tsx                  → Proteção de rota master
│   │       ├── empresas/page.tsx           → Painel master — empresas
│   │       └── usuarios/page.tsx           → Painel master — usuários
│   ├── context/
│   │   └── EmpresaContext.tsx              → Contexto multiempresa
│   ├── lib/
│   │   ├── supabase.ts                     → Cliente Supabase + utilitários
│   │   └── dados.ts                        → Dados compartilhados (profissionais, clientes)
│   └── types/
│       └── index.ts                        → Tipos TypeScript
├── supabase/
│   └── migrations/
│       ├── 001_schema_inicial.sql          → Schema completo do banco
│       ├── 002_usuario_master.sql          → Script para criar usuário master
│       └── 003_criar_usuario.sql           → Guia para criar usuários
├── .env.example                            → Modelo de variáveis de ambiente
├── .gitignore
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── vercel.json
└── package.json
```

---

## 🚀 Como rodar localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/agendapro.git
cd agendapro
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
```bash
# Copie o arquivo de exemplo
cp .env.example .env.local

# Edite o .env.local com suas credenciais do Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 4. Configurar o banco de dados
Execute no **SQL Editor** do Supabase:
```
supabase/migrations/001_schema_inicial.sql
```

### 5. Criar o usuário master
- Vá em **Authentication → Users → Add User** no Supabase
- Crie `lucas@fortitude.com` com uma senha
- Copie o UUID gerado
- Execute `supabase/migrations/002_usuario_master.sql` com o UUID

### 6. Rodar o projeto
```bash
npm run dev
```
Acesse: **http://localhost:3000**

---

## ☁️ Deploy na Vercel

### Passo 1 — Subir para o GitHub
```bash
git init
git add .
git commit -m "primeiro commit"
git branch -M main
git remote add origin https://github.com/seu-usuario/agendapro.git
git push -u origin main
```

### Passo 2 — Importar na Vercel
1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Selecione o repositório `agendapro`
4. Na seção **"Environment Variables"** adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = sua URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = sua chave anon do Supabase
5. Clique em **"Deploy"**

Pronto! A Vercel vai buildar e publicar automaticamente.

---

## 🔒 Variáveis de ambiente necessárias

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |

> ⚠️ **Nunca suba o `.env.local` para o GitHub.** Ele já está no `.gitignore`.

---

## 🧩 Módulos do sistema

| Módulo | Rota |
|---|---|
| Login | `/auth/login` |
| Dashboard | `/dashboard` |
| Agenda | `/dashboard/agenda` |
| Clientes | `/dashboard/clientes` |
| Profissionais | `/dashboard/profissionais` |
| Serviços | `/dashboard/servicos` |
| Financeiro | `/dashboard/financeiro` |
| Usuários | `/dashboard/usuarios` |
| Configurações | `/dashboard/configuracoes` |
| Master — Empresas | `/master/empresas` |
| Master — Usuários | `/master/usuarios` |

---

Desenvolvido com ❤️ — Next.js 14 + Supabase + Tailwind CSS
