import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron rodado a cada 30min pelo Vercel
// Envia confirmação WhatsApp para agendamentos que começam em 90min (+/- 15min)

export async function GET(req: NextRequest) {
  // Verificar header de segurança do Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Em dev sem CRON_SECRET, permite passar
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const agora = new Date()
  // Janela: agendamentos entre 75min e 105min a partir de agora (90min ± 15min)
  const ini = new Date(agora.getTime() + 75 * 60 * 1000)
  const fim = new Date(agora.getTime() + 105 * 60 * 1000)

  const iniISO = ini.toISOString()
  const fimISO = fim.toISOString()

  // Buscar agendamentos abertos na janela que ainda não receberam confirmação
  const { data: agendamentos, error } = await sb
    .from('agendamentos')
    .select(`
      id, data_inicio, cliente_id, servico_id, prof_id,
      empresa_id, confirmacao_wpp_enviada
    `)
    .eq('status', 'aberto')
    .gte('data_inicio', iniISO)
    .lte('data_inicio', fimISO)
    .not('confirmacao_wpp_enviada', 'is', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!agendamentos || agendamentos.length === 0) {
    return NextResponse.json({ message: 'Nenhum agendamento na janela', count: 0 })
  }

  let enviados = 0
  let erros = 0

  for (const ag of agendamentos) {
    try {
      // Buscar dados da empresa (config WhatsApp)
      const { data: empresa } = await sb
        .from('empresas')
        .select('id, nome, whatsapp_habilitado, whatsapp_instancia, wpp_auto_confirmacao')
        .eq('id', ag.empresa_id)
        .single()

      if (!empresa?.whatsapp_habilitado || !empresa?.wpp_auto_confirmacao) continue

      // Buscar URL e token da Evolution API (config global)
      const { data: cfgs } = await sb
        .from('config_sistema')
        .select('chave, valor')
        .in('chave', ['evolution_api_url', 'evolution_api_key'])

      const cfgMap: Record<string, string> = {}
      if (cfgs) cfgs.forEach((c: any) => { cfgMap[c.chave] = c.valor || '' })

      const evoUrl = cfgMap['evolution_api_url']
      const evoKey = cfgMap['evolution_api_key']
      const instancia = empresa.whatsapp_instancia || 'emp-' + ag.empresa_id.slice(0, 8)

      if (!evoUrl || !evoKey) continue

      // Buscar dados do cliente
      const { data: cliente } = await sb
        .from('clientes')
        .select('nome, whatsapp, telefone')
        .eq('id', ag.cliente_id)
        .single()

      const fone = cliente?.whatsapp || cliente?.telefone
      if (!fone) continue

      // Buscar serviço
      const { data: servico } = await sb
        .from('servicos')
        .select('nome')
        .eq('id', ag.servico_id)
        .maybeSingle()

      // Buscar template de confirmação da empresa
      const { data: tmpl } = await sb
        .from('mensagens_template')
        .select('mensagem')
        .eq('empresa_id', ag.empresa_id)
        .eq('tipo', 'confirmacao')
        .eq('ativo', true)
        .single()

      const dataHora = new Date(ag.data_inicio)
      const data = dataHora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' })
      const hora = dataHora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

      let mensagem = tmpl?.mensagem || `Olá {{cliente}}! Lembrando do seu horário:\n*Data:* {{data}}\n*Hora:* {{hora}}\n*Serviço:* {{servico}}\n\nAté logo! 😊`
      mensagem = mensagem
        .replace(/{{cliente}}/g, cliente?.nome || 'Cliente')
        .replace(/{{data}}/g, data)
        .replace(/{{hora}}/g, hora)
        .replace(/{{servico}}/g, servico?.nome || '')
        .replace(/{{empresa}}/g, empresa.nome || '')

      // Formatar número
      const numero = fone.replace(/\D/g, '')
      const numeroFinal = numero.startsWith('55') ? numero : '55' + numero

      // Enviar via Evolution API
      const res = await fetch(
        evoUrl.replace(/\/$/, '') + '/message/sendText/' + instancia,
        {
          method: 'POST',
          headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numeroFinal, text: mensagem }),
        }
      )

      if (res.ok) {
        // Marcar como enviado para não reenviar
        await sb
          .from('agendamentos')
          .update({ confirmacao_wpp_enviada: true })
          .eq('id', ag.id)
        enviados++
      } else {
        erros++
      }
    } catch {
      erros++
    }
  }

  return NextResponse.json({
    message: `Cron executado: ${enviados} enviados, ${erros} erros`,
    janela: `${iniISO} a ${fimISO}`,
    total: agendamentos.length,
    enviados,
    erros,
  })
}
