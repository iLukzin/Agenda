import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const PERMS_CADASTRO_RAPIDO = [
  { tela:'dashboard',       visualizar:true,  criar:false, alterar:false, excluir:false },
  { tela:'agenda',          visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'agenda_wpp',      visualizar:false, criar:false, alterar:false, excluir:false },
  { tela:'clientes',        visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'profissionais',   visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'servicos',        visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'financeiro',      visualizar:true,  criar:true,  alterar:true,  excluir:false },
  { tela:'rel_profissional',visualizar:true,  criar:false, alterar:false, excluir:false },
  { tela:'usuarios',        visualizar:false, criar:false, alterar:false, excluir:false },
  { tela:'configuracoes',   visualizar:false, criar:false, alterar:false, excluir:false },
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      empresa_nome, empresa_telefone, empresa_cnpj, empresa_email, empresa_endereco,
      usuario_nome, usuario_email, usuario_senha,
    } = body

    if (!empresa_nome?.trim())     return NextResponse.json({ error: 'Nome da empresa é obrigatório.' }, { status: 400 })
    if (!empresa_telefone?.trim()) return NextResponse.json({ error: 'Telefone é obrigatório.' }, { status: 400 })
    if (!usuario_nome?.trim())     return NextResponse.json({ error: 'Nome do usuário é obrigatório.' }, { status: 400 })
    if (!usuario_email?.trim())    return NextResponse.json({ error: 'E-mail do usuário é obrigatório.' }, { status: 400 })
    if (!usuario_senha || usuario_senha.length < 6)
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres.' }, { status: 400 })

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verificar e-mail duplicado
    const { data: emailExiste } = await admin
      .from('usuarios').select('id').eq('email', usuario_email.trim().toLowerCase()).maybeSingle()
    if (emailExiste)
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 400 })

    // Verificar CPF/CNPJ duplicado (se informado)
    if (empresa_cnpj?.trim()) {
      const cnpjLimpo = empresa_cnpj.replace(/\D/g, '').trim()
      if (cnpjLimpo.length > 0) {
        const { data: cnpjExiste } = await admin
          .from('empresas')
          .select('id, nome')
          .ilike('cnpj', `%${cnpjLimpo}%`)
          .maybeSingle()
        if (cnpjExiste) {
          const tipo = cnpjLimpo.length <= 11 ? 'CPF' : 'CNPJ'
          return NextResponse.json({
            error: `Este ${tipo} já está cadastrado no sistema. Se esqueceu sua senha, entre em contato com o suporte.`
          }, { status: 400 })
        }
      }
    }

    // Data de expiração do trial: 3 dias a partir de agora
    const agora = new Date()
    const expiracao = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000)

    // 1. Criar empresa com configurações padrão + trial
    const { data: empresa, error: errEmpresa } = await admin
      .from('empresas')
      .insert({
        nome:                   empresa_nome.trim(),
        telefone:               empresa_telefone.trim(),
        cnpj:                   empresa_cnpj?.trim() || null,
        email:                  empresa_email?.trim() || null,
        endereco:               empresa_endereco?.trim() || null,
        status:                 'ativo',
        plano:                  'basico',
        bloqueada:              false,
        // Configurações padrão já habilitadas
        financeiro_habilitado:  true,
        tipo_agenda:            'dia',   // Timeline por profissional
        // Trial
        is_trial:               true,
        data_expiracao_trial:   expiracao.toISOString(),
      })
      .select('id').single()

    if (errEmpresa || !empresa)
      return NextResponse.json({ error: 'Erro ao criar empresa. Tente novamente.' }, { status: 400 })

    // 2. Criar usuário no Auth
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email:         usuario_email.trim().toLowerCase(),
      password:      usuario_senha,
      email_confirm: true,
    })

    if (authErr || !authData?.user) {
      await admin.from('empresas').delete().eq('id', empresa.id)
      // Traduzir erros comuns do Supabase Auth
      let msgErro = authErr?.message || 'Erro desconhecido.'
      if (msgErro.toLowerCase().includes('already been registered') || msgErro.toLowerCase().includes('already registered'))
        msgErro = 'Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.'
      else if (msgErro.toLowerCase().includes('invalid email'))
        msgErro = 'E-mail inválido. Verifique e tente novamente.'
      else if (msgErro.toLowerCase().includes('password'))
        msgErro = 'Senha inválida. Use pelo menos 6 caracteres.'
      else if (msgErro.toLowerCase().includes('rate limit'))
        msgErro = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      return NextResponse.json({ error: 'Erro ao criar acesso: ' + msgErro }, { status: 400 })
    }

    // 3. Criar usuário na tabela
    const { data: usuario, error: errUsuario } = await admin
      .from('usuarios')
      .insert({
        auth_id:                authData.user.id,
        nome:                   usuario_nome.trim(),
        email:                  usuario_email.trim().toLowerCase(),
        empresa_id:             empresa.id,
        nivel_acesso:           'profissional',
        status:                 'ativo',
        bloquear_edicao_valor:  false,
        permitir_desconto:      true,
        permitir_finalizar:     true,
        permitir_cancelar:      true,
        permitir_ver_pagamento: true,
      })
      .select('id').single()

    if (errUsuario || !usuario) {
      await admin.auth.admin.deleteUser(authData.user.id)
      await admin.from('empresas').delete().eq('id', empresa.id)
      return NextResponse.json({ error: 'Erro ao salvar usuário. Tente novamente.' }, { status: 400 })
    }

    // 4. Permissões por tela
    await admin.from('permissoes_usuario').insert(
      PERMS_CADASTRO_RAPIDO.map(p => ({ usuario_id: usuario.id, empresa_id: empresa.id, ...p }))
    )

    return NextResponse.json({
      ok: true,
      expiracao: expiracao.toISOString(),
      message: 'Conta criada! Você tem 3 dias de acesso gratuito.',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro interno.' }, { status: 500 })
  }
}
