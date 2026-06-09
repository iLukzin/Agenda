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

  // O banco tem dois tipos de agendamentos:
  // - Antigos: salvos sem timezone, ex: 15:00:00+00:00 = 15h BRT (errado como UTC)
  // - Novos: salvos em UTC real, ex: 18:00:00Z = 15h BRT (correto)
  // Para cobrir ambos, buscamos em duas janelas:
  const agora = new Date() // UTC real do Vercel

  // Janela 1: agendamentos novos salvos em UTC correto (hora BRT = UTC-3)
  const ini1 = new Date(agora.getTime() + 75 * 60 * 1000)
  const fim1 = new Date(agora.getTime() + 105 * 60 * 1000)

  // Janela 2: agendamentos antigos salvos sem conversão (hora BRT salva como UTC)
  // Esses têm 3h a menos que o correto, então buscamos -3h
  const ini2 = new Date(agora.getTime() + 75 * 60 * 1000 - 3 * 60 * 60 * 1000)
  const fim2 = new Date(agora.getTime() + 105 * 60 * 1000 - 3 * 60 * 60 * 1000)

  const iniISO = ini2.toISOString() // janela mais cedo
  const fimISO = fim1.toISOString() // janela mais tarde
  // Isso cobre uma janela ampla de 4h que pega ambos os formatos

  // Debug: buscar TODOS os agendamentos abertos para ver o que existe
  const { data: todos } = await sb
    .from('agendamentos')
    .select('id, data_inicio, status, empresa_id')
    .eq('status', 'aberto')
    .order('data_inicio')
    .limit(10)

  // Buscar agendamentos na janela
  const { data: agendamentos, error } = await sb
    .from('agendamentos')
    .select('id, data_inicio, cliente_id, servico_id, prof_id, empresa_id, confirmacao_wpp_enviada')
    .eq('status', 'aberto')
    .gte('data_inicio', iniISO)
    .lte('data_inicio', fimISO)

  // Debug completo
  const debugInfo = {
    agora_utc: agora.toISOString(),
    janela_ini: iniISO,
    janela_fim: fimISO,
    todos_abertos: todos?.map(a => ({ id: a.id.slice(0,8), data_inicio: a.data_inicio })),
    na_janela_count: agendamentos?.length ?? 0,
    na_janela_erro: error?.message,
  }

  if (error) {
    const { data: ags2, error: err2 } = await sb
      .from('agendamentos')
      .select('id, data_inicio, cliente_id, servico_id, prof_id, empresa_id')
      .eq('status', 'aberto')
      .gte('data_inicio', iniISO)
      .lte('data_inicio', fimISO)
    if (err2) return NextResponse.json({ error: err2.message, debug: debugInfo }, { status: 500 })
    if (!ags2 || ags2.length === 0) return NextResponse.json({ message: 'Nenhum agendamento na janela', count: 0, debug: debugInfo })
    return await processarAgendamentos(sb, ags2.map(a => ({ ...a, confirmacao_wpp_enviada: false })), iniISO, fimISO)
  }

  if (!agendamentos || agendamentos.length === 0) {
    return NextResponse.json({ message: 'Nenhum agendamento na janela', count: 0, debug: debugInfo })
  }

  // Filtrar os que já receberam confirmação
  const pendentes = agendamentos.filter((a: any) => !a.confirmacao_wpp_enviada)
  if (pendentes.length === 0) {
    return NextResponse.json({ message: 'Todos já receberam confirmação', count: 0 })
  }

  return await processarAgendamentos(sb, pendentes, iniISO, fimISO)
}

async function processarAgendamentos(sb: any, agendamentos: any[], iniISO: string, fimISO: string) {
  let enviados = 0
  let erros = 0

  for (const ag of agendamentos) {
    try {
      const { data: empresa } = await sb
        .from('empresas')
        .select('id, nome, whatsapp_habilitado, whatsapp_instancia, wpp_auto_confirmacao')
        .eq('id', ag.empresa_id)
        .single()

      if (!empresa?.whatsapp_habilitado || !empresa?.wpp_auto_confirmacao) continue

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

      const { data: cliente } = await sb
        .from('clientes')
        .select('nome, whatsapp, telefone')
        .eq('id', ag.cliente_id)
        .single()

      const fone = cliente?.whatsapp || cliente?.telefone
      if (!fone) continue

      const { data: servico } = await sb
        .from('servicos')
        .select('nome')
        .eq('id', ag.servico_id)
        .maybeSingle()

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

      let mensagem = tmpl?.mensagem || `Olá {{cliente}}! Lembrando do seu horário:\n*Data:* {{data}}\n*Hora:* {{hora}}\n*Serviço:* {{servico}}\n\nAté logo!`
      mensagem = mensagem
        .replace(/{{cliente}}/g, cliente?.nome || 'Cliente')
        .replace(/{{data}}/g, data)
        .replace(/{{hora}}/g, hora)
        .replace(/{{servico}}/g, servico?.nome || '')
        .replace(/{{empresa}}/g, empresa.nome || '')

      const numero = fone.replace(/\D/g, '')
      const numeroFinal = numero.startsWith('55') ? numero : '55' + numero

      const res = await fetch(
        evoUrl.replace(/\/$/, '') + '/message/sendText/' + instancia,
        {
          method: 'POST',
          headers: { 'apikey': evoKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numeroFinal, text: mensagem }),
        }
      )

      if (res.ok) {
        try {
          await sb.from('agendamentos').update({ confirmacao_wpp_enviada: true }).eq('id', ag.id)
        } catch {}
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
