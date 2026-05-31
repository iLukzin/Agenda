import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { empresa_id, numero, mensagem } = await req.json()
    if (!empresa_id || !numero || !mensagem) {
      return NextResponse.json({ ok: false, erro: 'Parametros obrigatorios ausentes' })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar config da empresa
    const { data: emp } = await sb
      .from('empresas')
      .select('whatsapp_api_url,whatsapp_api_token,whatsapp_instancia,whatsapp_ativo')
      .eq('id', empresa_id)
      .single()

    if (!emp?.whatsapp_ativo || !emp.whatsapp_api_url) {
      return NextResponse.json({ ok: false, erro: 'WhatsApp nao configurado para esta empresa' })
    }

    // Formatar numero
    const digits = numero.replace(/\D/g, '')
    const numFmt = digits.startsWith('55') ? digits : '55' + digits

    // Enviar via Evolution API
    const url = emp.whatsapp_api_url.replace(/\/$/, '') + '/message/sendText/' + emp.whatsapp_instancia
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': emp.whatsapp_api_token },
      body: JSON.stringify({
        number: numFmt,
        options: { delay: 1000, presence: 'composing' },
        textMessage: { text: mensagem },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ ok: false, erro: err.slice(0, 100) })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: e.message })
  }
}
