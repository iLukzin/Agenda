// BUILD: 1779992105
'use client'



import { useState, useRef, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'
import { formatarMoeda, corStatus, labelStatus } from '@/lib/supabase'

type Metrica = {
  totalAgendamentos: number; finalizados: number; cancelados: number; abertos: number
  clientes: number; faturamento: number; ticketMedio: number
}
type AgLista = { id:string; hora:string; cliente:string; servico:string; status:string }

function pad(n: number) { return String(n).padStart(2,'0') }
function isoHoje(): string {
  const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}))
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate())
}
function isoIniMes(): string {
  const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}))
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-01'
}
function isoFimMes(): string {
  const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}))
  const f = new Date(d.getFullYear(), d.getMonth()+1, 0)
  return f.getFullYear() + '-' + pad(f.getMonth()+1) + '-' + pad(f.getDate())
}
function isoIniAno(): string {
  const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}))
  return d.getFullYear() + '-01-01'
}
function isoFimAno(): string {
  const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}))
  return d.getFullYear() + '-12-31'
}

function CardMetrica({ label, valor, sublabel, corBg, corText }: { label:string; valor:string; sublabel:string; corBg:string; corText:string }) {
  return (
    <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px 22px' }}>
      <p style={{ fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>{label}</p>
      <p style={{ fontSize:'26px', fontWeight:'700', color:corText, letterSpacing:'-0.5px', lineHeight:1, marginBottom:'6px' }}>{valor}</p>
      <p style={{ fontSize:'12px', color:'#9ca3af' }}>{sublabel}</p>
    </div>
  )
}


function useVisibilityRefresh(fn: () => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (typeof window === 'undefined') return
    let t = Date.now()
    const onVis = () => { if (document.visibilityState==='visible' && Date.now()-t>15000) ref.current(); t=Date.now() }
    const onFoc = () => { if (Date.now()-t>120000) ref.current(); t=Date.now() }
    const onBlr = () => { t=Date.now() }
    document.addEventListener('visibilitychange',onVis)
    window.addEventListener('focus',onFoc)
    window.addEventListener('blur',onBlr)
    return () => { document.removeEventListener('visibilitychange',onVis); window.removeEventListener('focus',onFoc); window.removeEventListener('blur',onBlr) }
  }, [])
}
export default function DashboardPage() {
  const { empresaAtiva } = useEmpresa()
  const [metricas, setMetricas] = useState<Metrica>({ totalAgendamentos:0, finalizados:0, cancelados:0, abertos:0, clientes:0, faturamento:0, ticketMedio:0 })
  const [agLista, setAgLista]   = useState<AgLista[]>([])
  const [recharts, setRecharts] = useState<any>(null)
  const [graficoDados, setGraficoDados] = useState<{dia:string;total:number;fechados:number}[]>([])
  const [carregando, setCarregando] = useState(true)

  // Filtros
  const [filtro, setFiltro]       = useState<'hoje'|'mes'|'periodo'>('hoje')
  const [periodoIni, setPeriodoIni] = useState(isoHoje())
  const [periodoFim, setPeriodoFim] = useState(isoHoje())
  const [showPeriodo, setShowPeriodo] = useState(false)

  useEffect(() => { import('recharts').then(m => setRecharts(m)) }, [])

  function aplicarFiltro(tipo: 'hoje'|'mes'|'periodo') {
    setFiltro(tipo)
    if (tipo === 'hoje') { setPeriodoIni(isoHoje()); setPeriodoFim(isoHoje()) }
    else if (tipo === 'mes') { setPeriodoIni(isoIniMes()); setPeriodoFim(isoFimMes()) }
    setShowPeriodo(tipo === 'periodo')
  }

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const ini = periodoIni
    const fim = periodoFim

    const [
      { data: agsRaw },
      { count: totalClientes },
      { data: lansRec },
    ] = await Promise.all([
      sb.from('agendamentos')
        .select('id,data_inicio,status,valor,cliente_id,servico_id')
        .eq('empresa_id', empresaAtiva.id)
        .gte('data_inicio', ini + 'T00:00:00')
        .lte('data_inicio', fim + 'T23:59:59')
        .order('data_inicio'),
      sb.from('clientes')
        .select('id', { count:'exact', head:true })
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'ativo'),
      sb.from('lancamentos')
        .select('valor,tipo,status')
        .eq('empresa_id', empresaAtiva.id)
        .eq('tipo', 'receita')
        .eq('status', 'pago')
        .gte('data_vencimento', ini)
        .lte('data_vencimento', fim),
    ])

    // Nomes de clientes e servicos
    const cliIds  = Array.from(new Set((agsRaw||[]).map((a:any)=>a.cliente_id).filter(Boolean)))
    const servIds = Array.from(new Set((agsRaw||[]).map((a:any)=>a.servico_id).filter(Boolean)))
    const cliMap:  Record<string,string> = {}
    const servMap: Record<string,string> = {}
    if (cliIds.length > 0) {
      const { data: cls } = await sb.from('clientes').select('id,nome').in('id', cliIds as string[])
      ;(cls||[]).forEach((c:any) => { cliMap[c.id] = c.nome })
    }
    if (servIds.length > 0) {
      const { data: servs } = await sb.from('servicos').select('id,nome').in('id', servIds as string[])
      ;(servs||[]).forEach((s:any) => { servMap[s.id] = s.nome })
    }

    const ags = agsRaw || []
    const fechados   = ags.filter((a:any) => a.status === 'fechado')
    const cancelados = ags.filter((a:any) => a.status === 'cancelado')
    const abertos    = ags.filter((a:any) => a.status === 'aberto')

    const fatAgs  = fechados.reduce((s:number, a:any) => s + (a.valor||0), 0)
    const fatLanc = (lansRec||[]).reduce((s:number, l:any) => s + (l.valor||0), 0)
    const faturamento = fatAgs + fatLanc
    const ticket = fechados.length > 0 ? fatAgs / fechados.length : 0

    // Grafico - agrupa por dia
    const porDia: Record<string, {total:number; fechados:number}> = {}
    ags.forEach((a:any) => {
      const d = a.data_inicio?.slice(0,10) || ''
      if (!porDia[d]) porDia[d] = { total:0, fechados:0 }
      porDia[d].total++
      if (a.status === 'fechado') porDia[d].fechados++
    })
    const grafico = Object.entries(porDia).sort(([a],[b]) => a.localeCompare(b)).map(([dia, v]) => ({
      dia: new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'}),
      total:    v.total,
      fechados: v.fechados,
    }))

    setMetricas({
      totalAgendamentos: ags.length,
      finalizados:       fechados.length,
      cancelados:        cancelados.length,
      abertos:           abertos.length,
      clientes:          totalClientes || 0,
      faturamento,
      ticketMedio:       ticket,
    })

    setAgLista(ags.slice(0, 20).map((a:any) => ({
      id:      a.id,
      hora:    a.data_inicio ? a.data_inicio.slice(11,16) : '--:--',
      cliente: cliMap[a.cliente_id] || '--',
      servico: servMap[a.servico_id] || '--',
      status:  a.status || '--',
    })))

    setGraficoDados(grafico)
    setCarregando(false)
  }, [empresaAtiva?.id, periodoIni, periodoFim])

  useEffect(() => {
    carregar()
    if (!empresaAtiva?.id) return
    const sb = createClient()
    const ch = sb
      .channel('dashboard-realtime-' + empresaAtiva.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos', filter: 'empresa_id=eq.' + empresaAtiva.id }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos', filter: 'empresa_id=eq.' + empresaAtiva.id }, () => carregar())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [carregar, empresaAtiva?.id])
  useVisibilityRefresh(carregar)

  const labelFiltro = filtro === 'hoje' ? 'Hoje' : filtro === 'mes' ? 'Este mes' :
    new Date(periodoIni+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'short'}) + ' - ' +
    new Date(periodoFim+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric'})

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'America/Sao_Paulo' })

  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Dashboard</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af', textTransform:'capitalize' }}>{hoje}</p>
          {empresaAtiva && <p style={{ fontSize:'12px', color:'#6366f1', fontWeight:'500', marginTop:'2px' }}>{empresaAtiva.nome}</p>}
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          {(['hoje','mes'] as const).map(f => (
            <button key={f} onClick={() => aplicarFiltro(f)}
              style={{ padding:'7px 14px', borderRadius:'99px', fontSize:'13px', fontWeight:'500', cursor:'pointer', border:filtro===f?'1.5px solid #6366f1':'1px solid #e5e7eb', background:filtro===f?'#eef2ff':'white', color:filtro===f?'#6366f1':'#6b7280' }}>
              {f === 'hoje' ? 'Hoje' : 'Este mes'}
            </button>
          ))}
          <div style={{ position:'relative' }}>
            <button onClick={() => { setShowPeriodo(!showPeriodo); setFiltro('periodo') }}
              style={{ padding:'7px 14px', borderRadius:'99px', fontSize:'13px', fontWeight:'500', cursor:'pointer', border:filtro==='periodo'?'1.5px solid #6366f1':'1px solid #e5e7eb', background:filtro==='periodo'?'#eef2ff':'white', color:filtro==='periodo'?'#6366f1':'#6b7280' }}>
              Periodo
            </button>
            {showPeriodo && (
              <><div onClick={() => setShowPeriodo(false)} style={{ position:'fixed', inset:0, zIndex:99 }}/>
              <div onClick={e => e.stopPropagation()} style={{ position:'absolute', right:0, top:'calc(100% + 8px)', zIndex:100, background:'white', borderRadius:'12px', border:'1px solid #e5e7eb', padding:'16px', boxShadow:'0 8px 30px rgba(0,0,0,0.1)', width:'240px' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>De</label>
                    <input type="date" value={periodoIni} onChange={e => setPeriodoIni(e.target.value)} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>Ate</label>
                    <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                  </div>
                </div>
                <button onClick={() => setShowPeriodo(false)} style={{ width:'100%', background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>Aplicar</button>
              </div></>
            )}
          </div>
        </div>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando dados...</div>
      ) : (
        <>
          <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'14px', fontWeight:'500' }}>
            Periodo: {labelFiltro} -- {metricas.totalAgendamentos} agendamento{metricas.totalAgendamentos !== 1 ? 's' : ''}
          </p>

          {/* Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'12px', marginBottom:'20px' }}>
            <CardMetrica label="Faturamento" valor={formatarMoeda(metricas.faturamento)} sublabel="fechados + lancamentos" corBg="#ecfdf5" corText="#10b981"/>
            <CardMetrica label="Ticket medio" valor={metricas.ticketMedio > 0 ? formatarMoeda(metricas.ticketMedio) : 'R$ 0,00'} sublabel={'media por atend. fechado'} corBg="#eef2ff" corText="#6366f1"/>
            <CardMetrica label="Finalizados" valor={String(metricas.finalizados)} sublabel={'de ' + metricas.totalAgendamentos + ' agendamentos'} corBg="#ecfdf5" corText="#10b981"/>
            <CardMetrica label="Em aberto" valor={String(metricas.abertos)} sublabel="agendamentos abertos" corBg="#fffbeb" corText="#f59e0b"/>
            <CardMetrica label="Cancelados" valor={String(metricas.cancelados)} sublabel="no periodo" corBg="#fef2f2" corText="#ef4444"/>
            <CardMetrica label="Clientes ativos" valor={String(metricas.clientes)} sublabel="cadastrados" corBg="#f0f9ff" corText="#0284c7"/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            {/* Grafico */}
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
              <h2 style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e', marginBottom:'4px' }}>Agendamentos no periodo</h2>
              <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'16px' }}>Total e finalizados por dia</p>
              {recharts && graficoDados.length > 0 ? (
                <recharts.ResponsiveContainer width="100%" height={160}>
                  <recharts.BarChart data={graficoDados}>
                    <recharts.CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8"/>
                    <recharts.XAxis dataKey="dia" tick={{ fontSize:10, fill:'#9ca3af' }} axisLine={false} tickLine={false}/>
                    <recharts.YAxis tick={{ fontSize:10, fill:'#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <recharts.Tooltip contentStyle={{ borderRadius:'8px', border:'1px solid #f0f0f8', fontSize:'12px' }}/>
                    <recharts.Bar dataKey="total" name="Total" fill="#e0e7ff" radius={[4,4,0,0]}/>
                    <recharts.Bar dataKey="fechados" name="Finalizados" fill="#6366f1" radius={[4,4,0,0]}/>
                  </recharts.BarChart>
                </recharts.ResponsiveContainer>
              ) : (
                <div style={{ height:'160px', display:'flex', alignItems:'center', justifyContent:'center', color:'#d1d5db', fontSize:'13px' }}>
                  {graficoDados.length === 0 ? 'Nenhum agendamento no periodo' : 'Carregando...'}
                </div>
              )}
            </div>

            {/* Resumo financeiro */}
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
              <h2 style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e', marginBottom:'4px' }}>Resumo financeiro</h2>
              <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'16px' }}>{labelFiltro}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {[
                  { label:'Agend. finalizados', valor: metricas.finalizados, tipo:'count', cor:'#10b981' },
                  { label:'Receita dos atend.', valor: metricas.faturamento, tipo:'money', cor:'#10b981' },
                  { label:'Ticket medio', valor: metricas.ticketMedio, tipo:'money', cor:'#6366f1' },
                  { label:'Em aberto', valor: metricas.abertos, tipo:'count', cor:'#f59e0b' },
                  { label:'Cancelados', valor: metricas.cancelados, tipo:'count', cor:'#ef4444' },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'8px', background:'#f9fafb' }}>
                    <span style={{ fontSize:'13px', color:'#6b7280' }}>{item.label}</span>
                    <span style={{ fontSize:'14px', fontWeight:'600', color:item.cor }}>
                      {item.tipo === 'money' ? formatarMoeda(item.valor as number) : String(item.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de agendamentos */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e' }}>Agendamentos do periodo</h2>
              <a href="/dashboard/agenda" style={{ fontSize:'13px', color:'#6366f1', textDecoration:'none', fontWeight:'500' }}>Ver agenda completa</a>
            </div>
            {agLista.length === 0 ? (
              <div style={{ textAlign:'center', padding:'30px', color:'#9ca3af', fontSize:'14px' }}>Nenhum agendamento no periodo selecionado.</div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'400px' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                      {['Horario','Cliente','Servico','Status'].map(c => (
                        <th key={c} style={{ padding:'8px 12px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agLista.map(ag => (
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
