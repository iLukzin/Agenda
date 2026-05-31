import { NextRequest, NextResponse } from 'next/server'
import { sessoes } from '../store'

export async function POST(req: NextRequest) {
  try {
    const { empresa_id } = await req.json()
    if (!empresa_id) return NextResponse.json({ erro: 'empresa_id obrigatorio' }, { status: 400 })

    const sessao = sessoes.get(empresa_id)
    if (sessao?.conectado) return NextResponse.json({ conectado: true })

    // Gerar QR Code usando whatsapp-web.js via importacao dinamica
    // Como nao podemos instalar pacotes aqui, retornamos instrucoes
    // O QR sera gerado via Supabase Edge Function ou servico externo configurado
    
    // Para MVP: retornar QR de demo ou indicar necessidade de backend dedicado
    return NextResponse.json({ 
      erro: 'Para usar WhatsApp nativo instale a Evolution API ou use nosso servico hospedado.',
      info: 'Acesse https://github.com/EvolutionAPI/evolution-api para instalar gratuitamente.',
      tipo: 'backend_necessario'
    })
  } catch (e: any) {
    return NextResponse.json({ erro: e.message }, { status: 500 })
  }
}
