import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const empresa_id = req.nextUrl.searchParams.get('empresa_id') || ''
    if (!empresa_id) return NextResponse.json({ conectado: false })

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: emp } = await sb
      .from('empresas')
      .select('whatsapp_api_url,whatsapp_api_token,whatsapp_instancia')
      .eq('id', empresa_id)
      .single()

    if (!emp?.whatsapp_api_url) return NextResponse.json({ conectado: false })

    const baseUrl = emp.whatsapp_api_url.replace(/\/$/, '')
    const headers = { 'apikey': emp.whatsapp_api_token }

    const res = await fetch(`${baseUrl}/instance/connectionState/${emp.whatsapp_instancia}`, { headers })
    if (!res.ok) return NextResponse.json({ conectado: false })

    const data = await res.json()
    const state = data?.instance?.state || data?.state || ''
    const conectado = state === 'open' || state === 'connected'

    return NextResponse.json({ conectado })
  } catch {
    return NextResponse.json({ conectado: false })
  }
}
