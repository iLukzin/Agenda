import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron rodado 1x por dia às 10h UTC (07h BRT).
// Verifica hoje e amanhã (BRT) e cria agendamentos para os
// dias que batem com o dia_semana de cada AutoAgenda ativo.
// O log usa a DATA DO AGENDAMENTO (ex: 23/06) e não a data
// em que o cron rodou — isso evita duplicatas independente de
// quantas vezes o cron rodar ou ser executado manualmente.

function getBRTDate(date: Date): { iso: string; diaSemana: number } {
  // BRT = UTC-3
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  return {
    iso: brt.toISOString().slice(0, 10),
    diaSemana: brt.getUTCDay(),
  }
}

// Dado um dia da semana alvo (0-6), retorna a data ISO do
// próximo dia com aquele dia_semana a partir de uma data base
function proximaDataComDia(base: Date, diaSemanaAlvo: number): string {
  const brt = getBRTDate(base)
  const hoje = brt.diaSemana
  let diff = diaSemanaAlvo - hoje
  if (diff < 0) diff += 7
  // diff = 0 significa hoje mesmo
  const alvo = new Date(base.getTime() - 3 * 60 * 60 * 1000) // em BRT
  alvo.setUTCDate(alvo.getUTCDate() + diff)
  return alvo.toISOString().slice(0, 10)
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
    }, { status: 500 })
  }

  const configsAtivas = configs.filter((c: any) =>
    c.empresas?.auto_agenda_habilitado === true &&
    c.empresas?.status === 'ativo'
  )

  let criados = 0
  let ignorados = 0
  let erros = 0
  const detalhes: string[] = []

  for (const cfg of configsAtivas) {
    const diaSemanaAlvo = Number(cfg.dia_semana)

    // Quais datas processar: a próxima ocorrência a partir de hoje,
    // e a próxima a partir de amanhã (para criar com 1 dia de antecedência)
    // Deduplica caso as duas apontem para a mesma data
    const dataDeHoje  = proximaDataComDia(agora, diaSemanaAlvo)
    const dataDeAmanha = proximaDataComDia(new Date(agora.getTime() + 24 * 60 * 60 * 1000), diaSemanaAlvo)

    const datas = Array.from(new Set([dataDeHoje, dataDeAmanha]))

    for (const dataAgendamento of datas) {
      // O log usa a DATA DO AGENDAMENTO, não a data de hoje
      // Isso garante que o mesmo agendamento não seja criado duas vezes
      const { data: logExiste } = await sb
        .from('auto_agenda_log')
        .select('id, agendamento_id')
        .eq('auto_agenda_id', cfg.id)
        .eq('data_agendada', dataAgendamento)
        .maybeSingle()

      if (logExiste) {
        // Log existe — mas verificar se o agendamento ainda existe
        // (pode ter sido excluído manualmente)
        if (logExiste.agendamento_id) {
          const { data: agAinda } = await sb
            .from('agendamentos')
            .select('id, status')
            .eq('id', logExiste.agendamento_id)
            .maybeSingle()

          if (agAinda && agAinda.status !== 'cancelado') {
            ignorados++
            detalhes.push(`Já existe agendamento ativo para ${dataAgendamento} (config ${cfg.id.slice(0,8)})`)
            continue
          }
          // Agendamento foi cancelado ou excluído — apaga o log e recria
          await sb.from('auto_agenda_log').delete().eq('id', logExiste.id)
          detalhes.push(`Agendamento cancelado/removido — recriando para ${dataAgendamento}`)
        } else {
          // Log sem agendamento_id (bug anterior) — apaga e reprocessa
          await sb.from('auto_agenda_log').delete().eq('id', logExiste.id)
          detalhes.push(`Log órfão removido para ${dataAgendamento} — reprocessando`)
        }
      }

      // Montar data/hora em BRT
      const hora = (cfg.horario || '00:00:00').slice(0, 5)
      const dataInicioBRT = new Date(`${dataAgendamento}T${hora}:00-03:00`)
      const dataFim       = new Date(dataInicioBRT.getTime() + 60 * 60 * 1000)

      // Verificar conflito ±10 min
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
        await sb.from('auto_agenda_log').insert({
          auto_agenda_id: cfg.id,
          agendamento_id: agExiste.id,
          data_agendada:  dataAgendamento,
        })
        ignorados++
        detalhes.push(`Agendamento já existe para ${dataAgendamento} ${hora} BRT`)
        continue
      }

      // Buscar duração do serviço
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

      // Criar agendamento
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
          observacoes:     'Agendado automaticamente (AutoAgenda)',
          tipo_cobranca:   'avulso',
          valor:           null,
        })
        .select('id')
        .single()

      if (errAg || !agCriado) {
        erros++
        detalhes.push(`ERRO criar para ${dataAgendamento}: ${errAg?.message}`)
        continue
      }

      // Registrar no log com a data do AGENDAMENTO
      await sb.from('auto_agenda_log').insert({
        auto_agenda_id: cfg.id,
        agendamento_id: agCriado.id,
        data_agendada:  dataAgendamento,
      })

      criados++
      detalhes.push(`CRIADO: ${dataAgendamento} às ${hora} BRT → UTC ${dataInicioBRT.toISOString()}`)
    }
  }

  return NextResponse.json({
    ok: true,
    message: `AutoAgenda: ${criados} criado(s), ${ignorados} ignorado(s), ${erros} erro(s)`,
    agora_utc:        agora.toISOString(),
    hoje_brt:         hoje.iso,
    hoje_diasemana:   hoje.diaSemana,
    amanha_brt:       amanha.iso,
    configs_ativas:   configsAtivas.length,
    criados,
    ignorados,
    erros,
    detalhes,
  })
}
