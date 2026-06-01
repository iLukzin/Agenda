import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { empresa_id } = await req.json()
    if (!empresa_id) return NextResponse.json({ erro: 'empresa_id obrigatorio' }, { status: 400 })

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Buscar config da empresa no banco
    const { data: emp } = await sb
      .from('empresas')
      .select('whatsapp_api_url,whatsapp_api_token,whatsapp_instancia,whatsapp_ativo')
      .eq('id', empresa_id)
      .single()

    if (!emp?.whatsapp_api_url || !emp?.whatsapp_api_token || !emp?.whatsapp_instancia) {
      return NextResponse.json({
        erro: 'Preencha e salve a URL da API, Token e Instancia antes de conectar.',
        tipo: 'config_incompleta'
      })
    }

    const baseUrl = emp.whatsapp_api_url.replace(/\/$/, '')
    const headers = { 'apikey': emp.whatsapp_api_token, 'Content-Type': 'application/json' }

    // 1. Verificar se já está conectado
    try {
      const statusRes = await fetch(`${baseUrl}/instance/connectionState/${emp.whatsapp_instancia}`, { headers })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        const state = statusData?.instance?.state || statusData?.state || ''
        if (state === 'open' || state === 'connected') {
          return NextResponse.json({ conectado: true })
        }
      }
    } catch {}

    // 2. Tentar criar instancia (pode já existir, ignorar erro)
    try {
      await fetch(`${baseUrl}/instance/create`, {
        method: 'POST', headers,
        body: JSON.stringify({ instanceName: emp.whatsapp_instancia, qrcode: true }),
      })
    } catch {}

    // 3. Buscar QR Code
    const qrRes = await fetch(`${baseUrl}/instance/connect/${emp.whatsapp_instancia}`, { headers })

    if (!qrRes.ok) {
      const errText = await qrRes.text()
      return NextResponse.json({ erro: `Erro ao conectar (${qrRes.status}): ${errText.slice(0, 150)}` })
    }

    const qrData = await qrRes.json()

    // Evolution API pode retornar em formatos diferentes
    const base64 = qrData?.qrcode?.base64 || qrData?.base64 || qrData?.qr || qrData?.code || ''

    if (!base64) {
      return NextResponse.json({ erro: 'QR Code nao retornado pela API. Verifique se a instancia esta correta e a API esta rodando.' })
    }

    const qrFinal = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
    return NextResponse.json({ qr: qrFinal })

  } catch (e: any) {
    return NextResponse.json({ erro: 'Erro de conexao com a API: ' + e.message }, { status: 500 })
  }
}
