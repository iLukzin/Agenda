import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron rodado 1x por dia às 10h UTC (07h BRT).
// Pode ser chamado manualmente via GET /api/cron/auto-agenda
// para forçar execução sem esperar o cron.

function getBRTDate(date: Date): { iso: string; diaSemana: number } {
  // BRT = UTC-3: subtrai 3h para obter o horário local brasileiro
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  const iso = brt.toISOString().slice(0, 10) // YYYY-MM-DD
  const diaSemana = brt.getUTCDay()          // 0=dom ... 6=sab
  return { iso, diaSemana }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const agora = new Date()

  // Hoje e amanhã no horário de Brasília (BRT = UTC-3)
  const hoje  = getBRTDate(agora)
  const amanha = getBRTDate(new Date(agora.getTime() + 24 * 60 * 60 * 1000))

  // Buscar todas as configs ativas com join na empresa
  const { data: configs, error: errConfigs } = await sb
    .from('auto_agenda')
    .select(`
      id,
      empresa_id,
      cliente_id,
      profissional_id,
      servico_id,
      dia_semana,
      horario,
      ativo,
      empresas!inner ( id, auto_agenda_habilitado, status )
    `)
    .eq('ativo', true)

  if (errConfigs || !configs) {
    return NextResponse.json({
      ok: false,
      error: errConfigs?.message || 'Erro ao buscar configs',
      hoje: hoje.iso,
      amanha: amanha.iso,
    }, { status: 500 })
  }

  // Só processa empresas com módulo habilitado e ativas
  const configsAtivas = configs.filter((c: any) =>
    c.empresas?.auto_agenda_habilitado === true &&
    c.empresas?.status === 'ativo'
  )

  let criados = 0
  let ignorados = 0
  let erros = 0
  const detalhes: string[] = []

  for (const cfg of configsAtivas) {
    // Verifica se hoje ou amanhã batem com o dia_semana configurado
    const datas: { iso: string; diaSemana: number }[] = []
    if (hoje.diaSemana  === Number(cfg.dia_semana)) datas.push(hoje)
    if (amanha.diaSemana === Number(cfg.dia_semana)) datas.push(amanha)
    if (datas.length === 0) continue

    for (const dt of datas) {
      // 1. Verificar log — se já foi processado hoje para esta data, pula
      const { data: logExiste, error: errLog } = await sb
        .from('auto_agenda_log')
        .select('id')
        .eq('auto_agenda_id', cfg.id)
        .eq('data_agendada', dt.iso)
        .maybeSingle()

      if (logExiste) {
        ignorados++
        detalhes.push(`Log já existe: ${dt.iso} para config ${cfg.id.slice(0,8)}`)
        continue
      }

      // 2. Montar data/hora do agendamento em BRT
      const hora = (cfg.horario || '00:00:00').slice(0, 5) // HH:MM
      // Cria a data como se fosse BRT e converte para UTC para salvar
      const dataInicioBRT = new Date(`${dt.iso}T${hora}:00-03:00`)
      const dataFim = new Date(dataInicioBRT.getTime() + 60 * 60 * 1000) // +1h padrão

      // 3. Verificar se já existe agendamento do cliente no mesmo horário (±10 min)
      const janelaMinus = new Date(dataInicioBRT.getTime() - 10 * 60 * 1000).toISOString()
      const janelaPlus  = new Date(dataInicioBRT.getTime() + 10 * 60 * 1000).toISOString()

      const { data: agExiste } = await sb
        .from('agendamentos')
        .select('id')
        .eq('empresa_id', cfg.empresa_id)
        .eq('cliente_id', cfg.cliente_id)
        .gte('data_inicio', janelaMinus)
        .lte('data_inicio', janelaPlus)
        .neq('status', 'cancelado')
        .maybeSingle()

      if (agExiste) {
        // Registra no log para não processar de novo
        await sb.from('auto_agenda_log').insert({
          auto_agenda_id: cfg.id,
          agendamento_id: agExiste.id,
          data_agendada: dt.iso,
        })
        ignorados++
        detalhes.push(`Agendamento já existe: cliente ${cfg.cliente_id.slice(0,8)} em ${dt.iso} ${hora}`)
        continue
      }

      // 4. Buscar duração do serviço (se tiver)
      let duracaoMin = 60
      if (cfg.servico_id) {
        const { data: srv } = await sb
          .from('servicos')
          .select('duracao')
          .eq('id', cfg.servico_id)
          .maybeSingle()
        if (srv?.duracao && Number(srv.duracao) > 0) {
          duracaoMin = Number(srv.duracao)
        }
      }
      const dataFimComDuracao = new Date(dataInicioBRT.getTime() + duracaoMin * 60 * 1000)

      // 5. Criar o agendamento
      const { data: agCriado, error: errAg } = await sb
        .from('agendamentos')
        .insert({
          empresa_id:      cfg.empresa_id,
          cliente_id:      cfg.cliente_id,
          prof_id:         cfg.profissional_id || null,
          profissional_id: cfg.profissional_id || null,
          servico_id:      cfg.servico_id || null,
          data_inicio:     dataInicioBRT.toISOString(),
          data_fim:        dataFimComDuracao.toISOString(),
          status:          'aberto',
          origem:          'auto_agenda',
          observacoes:     'Agendado automaticamente (AutoAgenda)',
          tipo_cobranca:   'avulso',
          valor:           null,
        })
        .select('id')
        .single()

      if (errAg || !agCriado) {
        erros++
        detalhes.push(`ERRO criar: cliente ${cfg.cliente_id.slice(0,8)} em ${dt.iso} - ${errAg?.message}`)
        continue
      }

      // 6. Registrar no log
      const { error: errLogInsert } = await sb.from('auto_agenda_log').insert({
        auto_agenda_id: cfg.id,
        agendamento_id: agCriado.id,
        data_agendada:  dt.iso,
      })

      if (errLogInsert) {
        detalhes.push(`Aviso: agendamento criado mas log falhou - ${errLogInsert.message}`)
      }

      criados++
      detalhes.push(`CRIADO: cliente ${cfg.cliente_id.slice(0,8)} em ${dt.iso} às ${hora} BRT (UTC: ${dataInicioBRT.toISOString()})`)
    }
  }

  return NextResponse.json({
    ok: true,
    message: `AutoAgenda concluído: ${criados} criado(s), ${ignorados} ignorado(s), ${erros} erro(s)`,
    agora_utc:      agora.toISOString(),
    hoje_brt:       hoje.iso,
    hoje_diasemana: hoje.diaSemana,
    amanha_brt:     amanha.iso,
    amanha_diasemana: amanha.diaSemana,
    configs_ativas: configsAtivas.length,
    criados,
    ignorados,
    erros,
    detalhes,
  })
}
