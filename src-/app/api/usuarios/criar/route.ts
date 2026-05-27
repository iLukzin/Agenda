import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, email, senha, telefone, cargo, nivel_acesso, empresa_id } = body

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, email e senha são obrigatórios.' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Chave de serviço não configurada.' }, { status: 500 })
    }

    // Admin client — bypassa confirmação de email
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verifica se email já existe na tabela
    const { data: existente } = await admin
      .from('usuarios')
      .select('id')
      .eq('email', email.trim())
      .maybeSingle()

    if (existente) {
      return NextResponse.json({ error: 'Este e-mail já está cadastrado.' }, { status: 400 })
    }

    // Cria no Auth com email já confirmado
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email:         email.trim(),
      password:      senha,
      email_confirm: true,
    })

    if (authErr) {
      return NextResponse.json({ error: 'Erro ao criar acesso: ' + authErr.message }, { status: 400 })
    }

    // Insere na tabela usuarios
    const { data, error: insErr } = await admin
      .from('usuarios')
      .insert({
        auth_id:      authData.user.id,
        nome:         nome.trim(),
        email:        email.trim(),
        telefone:     telefone || null,
        cargo:        cargo || null,
        nivel_acesso: nivel_acesso || 'profissional',
        empresa_id:   empresa_id || null,
        status:       'ativo',
      })
      .select('id, nome, email')
      .single()

    if (insErr) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Erro ao salvar: ' + insErr.message }, { status: 400 })
    }

    return NextResponse.json({ data, success: true })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro interno.' }, { status: 500 })
  }
}
