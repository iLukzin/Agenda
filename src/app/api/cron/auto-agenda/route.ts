import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Cron rodado 1x por dia (às 07h BRT = 10h UTC).
// Verifica todas as configurações de AutoAgenda ativas e cria
// agendamentos para o dia corrente SE o dia_semana bater.
// Também verifica o DIA SEGUINTE para criar com antecedência de 1 dia.
// A tabela auto_agenda_log garante que não haja duplicatas.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Data de hoje e amanhã no fuso BRT (UTC-3)
  const agora = new Date()
  const brtOffset = -3 * 60 // minutos
  const brtNow = new Date(agora.getTime() + brtOffset * 60 * 1000)

  function toBRTDate(d: Date) {
    const t = new Date(d.getTime() + brtOffset * 60 * 1000)
    return {
      iso: t.toISOString().slice(0, 10), // YYYY-MM-DD
      diaSemana: t.getUTCDay(),           // 0=dom ... 6=sab
    }
  }

  const hoje = toBRTDate(agora)
  const amanha = toBRTDate(new Date(agora.getTime() + 24 * 60 * 60 * 1000))

  // Buscamos configs ativas de todas as empresas com auto_agenda_habilitado
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
    return NextResponse.json({ error: errConfigs?.message || 'Sem dados', ok: false }, { status: 500 })
  }

  // Filtra só empresas com o módulo habilitado e não bloqueadas
  const configsAtivas = configs.filter((c: any) =>
    c.empresas?.auto_agenda_habilitado === true &&
    c.empresas?.status === 'ativo'
  )

  let criados = 0
  let ignorados = 0
  let erros = 0
  const detalhes: string[] = []

  for (const cfg of configsAtivas) {
    // Determina quais datas processar: hoje e/ou amanhã
    const datas: { iso: string; diaSemana: number }[] = []
    if (hoje.diaSemana === cfg.dia_semana)   datas.push(hoje)
    if (amanha.diaSemana === cfg.dia_semana) datas.push(amanha)
    if (datas.length === 0) continue

    for (const dt of datas) {
      // Verificar se já existe log para esta data (evita duplicata)
      const { data: logExiste } = await sb
        .from('auto_agenda_log')
        .select('id')
        .eq('auto_agenda_id', cfg.id)
        .eq('data_agendada', dt.iso)
        .maybeSingle()

      if (logExiste) {
        ignorados++
        continue
      }

      // Verificar se já existe agendamento do cliente neste dia/horário
      const dataInicio = `${dt.iso}T${cfg.horario.slice(0, 5)}:00-03:00`
      const inicioISO = new Date(dataInicio).toISOString()
      // Janela de ±5 minutos para verificar conflito
      const janelaMinus = new Date(new Date(dataInicio).getTime() - 5 * 60 * 1000).toISOString()
      const janelaPlus  = new Date(new Date(dataInicio).getTime() + 5 * 60 * 1000).toISOString()

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
        // Registra no log para não tentar de novo
        await sb.from('auto_agenda_log').insert({
          auto_agenda_id: cfg.id,
          agendamento_id: agExiste.id,
          data_agendada: dt.iso,
        }).onConflict('auto_agenda_id, data_agendada').ignore()
        ignorados++
        detalhes.push(`Já existe: cliente ${cfg.cliente_id.slice(0,8)} em ${dt.iso} ${cfg.horario}`)
        continue
      }

      // Buscar duração do serviço para calcular data_fim
      let duracaoMin = 60
      if (cfg.servico_id) {
        const { data: srv } = await sb
          .from('servicos')
          .select('duracao, preco')
          .eq('id', cfg.servico_id)
          .maybeSingle()
        if (srv?.duracao) duracaoMin = Number(srv.duracao)
      }

      const dataInicioObj = new Date(dataInicio)
      const dataFimObj    = new Date(dataInicioObj.getTime() + duracaoMin * 60 * 1000)

      // Criar agendamento
      const { data: agCriado, error: errAg } = await sb
        .from('agendamentos')
        .insert({
          empresa_id:      cfg.empresa_id,
          cliente_id:      cfg.cliente_id,
          prof_id:         cfg.profissional_id || null,
          profissional_id: cfg.profissional_id || null,
          servico_id:      cfg.servico_id || null,
          data_inicio:     dataInicioObj.toISOString(),
          data_fim:        dataFimObj.toISOString(),
          status:          'aberto',
          origem:          'auto_agenda',
          observacoes:     'Agendado automaticamente pelo sistema (AutoAgenda)',
          tipo_cobranca:   'avulso',
          valor:           null,
        })
        .select('id')
        .single()

      if (errAg || !agCriado) {
        erros++
        detalhes.push(`Erro ao criar: cliente ${cfg.cliente_id.slice(0,8)} - ${errAg?.message}`)
        continue
      }

      // Registrar no log
      await sb.from('auto_agenda_log').insert({
        auto_agenda_id:  cfg.id,
        agendamento_id:  agCriado.id,
        data_agendada:   dt.iso,
      })

      criados++
      detalhes.push(`Criado: cliente ${cfg.cliente_id.slice(0,8)} em ${dt.iso} às ${cfg.horario}`)
    }
  }

  return NextResponse.json({
    ok: true,
    message: `AutoAgenda: ${criados} criado(s), ${ignorados} ignorado(s), ${erros} erro(s)`,
    hoje: hoje.iso,
    amanha: amanha.iso,
    configs_ativas: configsAtivas.length,
    criados,
    ignorados,
    erros,
    detalhes,
  })
}
