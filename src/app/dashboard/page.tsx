'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'
import { formatarMoeda, corStatus, labelStatus } from '@/lib/supabase'

type Metrica = { agendamentosHoje: number; confirmados: number; clientes: number; faturamentoMes: number; ticketMedio: number }
type AgHoje   = { id:string; hora:string; cliente:string; servico:string; status:string }

function hojeISO(): string {
  const s = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function inicioMesISO(): string {
  const s = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(s)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function fimMesISO(): string {
  const s = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(s)
  const fim = new Date(d.getFullYear(), d.getMonth()+1, 0)
  return `${fim.getFullYear()}-${String(fim.getMonth()+1).padStart(2,'0')}-${String(fim.getDate()).padStart(2,'0')}`
}

function CardMetrica({ label, valor, sublabel, cor, icone }: { label:string; valor:string; sublabel:string; cor:string; icone:string }) {
  return (
    <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'22px 24px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:'12px', fontWeight:'500', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>{label}</p>
          <p style={{ fontSize:'28px', fontWeight:'700', color:'#1a1a2e', letterSpacing:'-1px', lineHeight:1 }}>{valor}</p>
          <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'6px' }}>{sublabel}</p>
        </div>
        <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:cor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>{icone}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { empresaAtiva } = useEmpresa()
  const [metricas, setMetricas]     = useState<Metrica>({ agendamentosHoje:0, confirmados:0, clientes:0, faturamentoMes:0, ticketMedio:0 })
  const [agHoje, setAgHoje]         = useState<AgHoje[]>([])
  const [recharts, setRecharts]     = useState<any>(null)
  const [graficoDados, setGraficoDados] = useState<{dia:string;valor:number}[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { import('recharts').then(m => setRecharts(m)) }, [])

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb   = createClient()
    const hoje = hojeISO()
    const ini  = inicioMesISO()
    const fim  = fimMesISO()

    // Agendamentos de hoje
    const { data: agsHoje } = await sb
      .from('agendamentos')
      .select('id, data_inicio, status, cliente:clientes(nome), servico:servicos(nome,cor)')
      .eq('empresa_id', empresaAtiva.id)
      .gte('data_inicio', hoje + 'T00:00:00')
      .lte('data_inicio', hoje + 'T23:59:59')
      .order('data_inicio')

    // Total clientes
    const { count: totalClientes } = await sb
      .from('clientes')
      .select('id', { count:'exact', head:true })
      .eq('empresa_id', empresaAtiva.id)
      .eq('status', 'ativo')

    // Agendamentos do mês para faturamento
    const { data: agsMes } = await sb
      .from('agendamentos')
      .select('valor, status')
      .eq('empresa_id', empresaAtiva.id)
      .gte('data_inicio', ini + 'T00:00:00')
      .lte('data_inicio', fim + 'T23:59:59')
      .eq('status', 'Finalizado')

    const faturamento = (agsMes || []).reduce((s: number, a: any) => s + (a.valor||0), 0)
    const ticket = agsMes && agsMes.length > 0 ? faturamento / agsMes.length : 0
    const confirmados = (agsHoje || []).filter((a: any) => a.status === 'Confirmado').length

    // Últimos 7 dias para gráfico
    const { data: agsGrafico } = await sb
      .from('agendamentos')
      .select('data_inicio, valor, status')
      .eq('empresa_id', empresaAtiva.id)
      .gte('data_inicio', new Date(Date.now()-7*86400000).toISOString().slice(0,10) + 'T00:00:00')
      .lte('data_inicio', hoje + 'T23:59:59')

    // Agrupa por dia
    const porDia: Record<string,number> = {}
    ;(agsGrafico||[]).forEach((a: any) => {
      const d = a.data_inicio?.slice(0,10) || ''
      if (!porDia[d]) porDia[d] = 0
      porDia[d]++
    })
    const grafico = Object.entries(porDia).sort(([a],[b])=>a.localeCompare(b)).map(([dia,val]) => ({
      dia: new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'}),
      valor: val,
    }))

    setMetricas({
      agendamentosHoje: agsHoje?.length || 0,
      confirmados,
      clientes: totalClientes || 0,
      faturamentoMes: faturamento,
      ticketMedio: ticket,
    })

    setAgHoje((agsHoje || []).map((a: any) => ({
      id:      a.id,
      hora:    a.data_inicio ? a.data_inicio.slice(11,16) : '--:--',
      cliente: a.cliente?.nome || '—',
      servico: (a.servico as any)?.nome || '—',
      status:  a.status || '—',
    })))

    setGraficoDados(grafico)
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'America/Sao_Paulo' })

  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Dashboard</h1>
        <p style={{ fontSize:'13px', color:'#9ca3af', textTransform:'capitalize' }}>{hoje}</p>
        {empresaAtiva && <p style={{ fontSize:'12px', color:'#6366f1', fontWeight:'500', marginTop:'2px' }}>📍 {empresaAtiva.nome}</p>}
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando dados...</div>
      ) : (
        <>
          {/* Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px,1fr))', gap:'14px', marginBottom:'20px' }}>
            <CardMetrica label="Agendamentos hoje" valor={String(metricas.agendamentosHoje)} sublabel={`${metricas.confirmados} confirmados`}           cor="#eef2ff" icone="📅"/>
            <CardMetrica label="Clientes ativos"   valor={String(metricas.clientes)}         sublabel="cadastrados"                                        cor="#ecfdf5" icone="👥"/>
            <CardMetrica label="Fat. do mês"       valor={formatarMoeda(metricas.faturamentoMes)} sublabel="agend. finalizados"                           cor="#fffbeb" icone="💰"/>
            <CardMetrica label="Ticket médio"      valor={metricas.ticketMedio>0?formatarMoeda(metricas.ticketMedio):'—'} sublabel="por atendimento"      cor="#fdf4ff" icone="📊"/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            {/* Gráfico 7 dias */}
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
              <h2 style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e', marginBottom:'4px' }}>Agendamentos — últimos 7 dias</h2>
              <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'16px' }}>Total por dia</p>
              {recharts && graficoDados.length > 0 ? (
                <recharts.ResponsiveContainer width="100%" height={160}>
                  <recharts.BarChart data={graficoDados}>
                    <recharts.CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8"/>
                    <recharts.XAxis dataKey="dia" tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false}/>
                    <recharts.YAxis tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <recharts.Tooltip contentStyle={{ borderRadius:'8px', border:'1px solid #f0f0f8', fontSize:'12px' }}/>
                    <recharts.Bar dataKey="valor" name="Agendamentos" fill="#6366f1" radius={[4,4,0,0]}/>
                  </recharts.BarChart>
                </recharts.ResponsiveContainer>
              ) : (
                <div style={{ height:'160px', display:'flex', alignItems:'center', justifyContent:'center', color:'#d1d5db', fontSize:'13px' }}>
                  {graficoDados.length === 0 ? 'Nenhum agendamento nos últimos 7 dias' : 'Carregando gráfico...'}
                </div>
              )}
            </div>

            {/* Distribuição por status */}
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
              <h2 style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e', marginBottom:'4px' }}>Agendamentos de hoje</h2>
              <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'16px' }}>{metricas.agendamentosHoje} agendamento{metricas.agendamentosHoje!==1?'s':''}</p>
              {agHoje.length === 0 ? (
                <div style={{ height:'160px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#d1d5db' }}>
                  <p style={{ fontSize:'28px', marginBottom:'8px' }}>📭</p>
                  <p style={{ fontSize:'13px' }}>Nenhum agendamento hoje</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxHeight:'170px', overflowY:'auto' }}>
                  {agHoje.map(ag => (
                    <div key={ag.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px', background:'#f9fafb' }}>
                      <span style={{ fontSize:'13px', fontWeight:'700', color:'#6366f1', fontFamily:'monospace', flexShrink:0 }}>{ag.hora}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'13px', fontWeight:'500', color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.cliente}</p>
                        <p style={{ fontSize:'11px', color:'#9ca3af' }}>{ag.servico}</p>
                      </div>
                      <span className={corStatus(ag.status)} style={{ fontSize:'10px', padding:'2px 8px', borderRadius:'99px', flexShrink:0 }}>
                        {labelStatus(ag.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Próximos agendamentos */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e' }}>Agenda de hoje — detalhes</h2>
              <a href="/dashboard/agenda" style={{ fontSize:'13px', color:'#6366f1', textDecoration:'none', fontWeight:'500' }}>Ver agenda completa →</a>
            </div>
            {agHoje.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px', color:'#9ca3af', fontSize:'14px' }}>
                📭 Nenhum agendamento para hoje
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'400px' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                      {['Horário','Cliente','Serviço','Status'].map(c => (
                        <th key={c} style={{ padding:'8px 12px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agHoje.map(ag => (
                      <tr key={ag.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                        <td style={{ padding:'12px' }}><span style={{ fontFamily:'monospace', fontWeight:'700', color:'#1a1a2e', fontSize:'14px' }}>{ag.hora}</span></td>
                        <td style={{ padding:'12px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'700', color:'#6366f1', flexShrink:0 }}>
                              {ag.cliente.split(' ').map(n=>n[0]).slice(0,2).join('')}
                            </div>
                            <span style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e' }}>{ag.cliente}</span>
                          </div>
                        </td>
                        <td style={{ padding:'12px', fontSize:'13px', color:'#6b7280' }}>{ag.servico}</td>
                        <td style={{ padding:'12px' }}>
                          <span className={corStatus(ag.status)} style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'99px', fontWeight:'500' }}>
                            {labelStatus(ag.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
