import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Permissões padrão para o usuário criado no cadastro rápido:
// agenda, clientes, profissionais, serviços, financeiro, dashboard — criar e alterar
// o resto sem permissão
const PERMS_CADASTRO_RAPIDO = [
  { tela:'dashboard',     visualizar:true,  criar:false, alterar:false, excluir:false },
  { tela:'agenda',        visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'agenda_wpp',    visualizar:false, criar:false, alterar:false, excluir:false },
  { tela:'clientes',      visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'profissionais', visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'servicos',      visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'financeiro',    visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'usuarios',      visualizar:false, criar:false, alterar:false, excluir:false },
  { tela:'configuracoes', visualizar:false, criar:false, alterar:false, excluir:false },
  { tela:'rel_profissional', visualizar:false, criar:false, alterar:false, excluir:false },
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      // Empresa
      empresa_nome, empresa_telefone, empresa_cnpj, empresa_email, empresa_endereco,
      // Usuário
      usuario_nome, usuario_email, usuario_senha,
    } = body

    // Validações obrigatórias
    if (!empresa_nome?.trim())     return NextResponse.json({ error: 'Nome da empresa é obrigatório.' }, { status: 400 })
    if (!empresa_telefone?.trim()) return NextResponse.json({ error: 'Telefone da empresa é obrigatório.' }, { status: 400 })
    if (!usuario_nome?.trim())     return NextResponse.json({ error: 'Nome do usuário é obrigatório.' }, { status: 400 })
    if (!usuario_email?.trim())    return NextResponse.json({ error: 'E-mail do usuário é obrigatório.' }, { status: 400 })
    if (!usuario_senha || usuario_senha.length < 6) return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres.' }, { status: 400 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Verificar se e-mail já está em uso
    const { data: emailExiste } = await admin
      .from('usuarios')
      .select('id')
      .eq('email', usuario_email.trim().toLowerCase())
      .maybeSingle()

    if (emailExiste) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado no sistema.' }, { status: 400 })
    }

    // 2. Criar a empresa
    const { data: empresa, error: errEmpresa } = await admin
      .from('empresas')
      .insert({
        nome:         empresa_nome.trim(),
        telefone:     empresa_telefone.trim(),
        cnpj:         empresa_cnpj?.trim() || null,
        email:        empresa_email?.trim() || null,
        endereco:     empresa_endereco?.trim() || null,
        status:       'ativo',
        plano:        'basico',
      })
      .select('id')
      .single()

    if (errEmpresa || !empresa) {
      return NextResponse.json({ error: 'Erro ao criar empresa: ' + (errEmpresa?.message || 'desconhecido') }, { status: 400 })
    }

    // 3. Criar usuário no Auth
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email:         usuario_email.trim().toLowerCase(),
      password:      usuario_senha,
      email_confirm: true,
    })

    if (authErr || !authData?.user) {
      // Reverter criação da empresa
      await admin.from('empresas').delete().eq('id', empresa.id)
      return NextResponse.json({ error: 'Erro ao criar acesso: ' + (authErr?.message || 'desconhecido') }, { status: 400 })
    }

    // 4. Criar registro na tabela usuários
    const { data: usuario, error: errUsuario } = await admin
      .from('usuarios')
      .insert({
        auth_id:               authData.user.id,
        nome:                  usuario_nome.trim(),
        email:                 usuario_email.trim().toLowerCase(),
        empresa_id:            empresa.id,
        nivel_acesso:          'profissional',
        status:                'ativo',
        // Flags de permissões do agendamento — todas habilitadas
        bloquear_edicao_valor: false,
        permitir_desconto:     true,
        permitir_finalizar:    true,
        permitir_cancelar:     true,
        permitir_ver_pagamento: true,
      })
      .select('id')
      .single()

    if (errUsuario || !usuario) {
      // Reverter
      await admin.auth.admin.deleteUser(authData.user.id)
      await admin.from('empresas').delete().eq('id', empresa.id)
      return NextResponse.json({ error: 'Erro ao salvar usuário: ' + (errUsuario?.message || 'desconhecido') }, { status: 400 })
    }

    // 5. Inserir permissões por tela
    const permsInsert = PERMS_CADASTRO_RAPIDO.map(p => ({
      usuario_id: usuario.id,
      empresa_id: empresa.id,
      ...p,
    }))

    await admin.from('permissoes_usuario').insert(permsInsert)

    return NextResponse.json({
      ok: true,
      message: 'Cadastro realizado com sucesso! Faça login com o e-mail e senha cadastrados.',
      empresa_id: empresa.id,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro interno.' }, { status: 500 })
  }
}
