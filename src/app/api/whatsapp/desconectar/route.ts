import { NextRequest, NextResponse } from 'next/server'
import { sessoes } from '../store'

export async function POST(req: NextRequest) {
  const { empresa_id } = await req.json()
  if (empresa_id) sessoes.delete(empresa_id)
  return NextResponse.json({ ok: true })
}
