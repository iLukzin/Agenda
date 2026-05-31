import { NextRequest, NextResponse } from 'next/server'
import { sessoes } from '../store'

export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get('empresa_id') || ''
  const sessao = sessoes.get(empresaId)
  return NextResponse.json({ conectado: sessao?.conectado || false })
}
