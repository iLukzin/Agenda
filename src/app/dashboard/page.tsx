'use client'

import { useState, useEffect } from 'react'
import { formatarMoeda, corStatus, labelStatus } from '@/lib/supabase'

// Recharts importado somente no cliente via useEffect
let RechartsComponents: any = null

const dadosFaturamento = [
  { dia:'01/01', valor:1200 }, { dia:'02/01', valor:980  }, { dia:'03/01', valor:1500 },
  { dia:'04/01', valor:1100 }, { dia:'05/01', valor:1800 }, { dia:'06/01', valor:1350 },
  { dia:'07/01', valor:2100 }, { dia:'08/01', valor:1650 }, { dia:'09/01', valor:1900 },
  { dia:'10/01', valor:1400 }, { dia:'11/01', valor:2200 }, { dia:'12/01', valor:1750 },
]

const servicosTop = [
  { nome:'Consulta',           total:45 },
  { nome:'Sessão Terapêutica', total:38 },
  { nome:'Avaliação',          total:22 },
  { nome:'Retorno',            total:18 },
]

const proximosAgendamentos = [
  { id:1, cliente:'Maria Silva',    servico:'Consulta',    hora:'09:00', status:'confirmado'     },
  { id:2, cliente:'João Santos',    servico:'Avaliação',   hora:'10:30', status:'agendado'       },
  { id:3, cliente:'Ana Costa',      servico:'Retorno',     hora:'11:00', status:'confirmado'     },
  { id:4, cliente:'Pedro Oliveira', servico:'Sessão Ter.', hora:'14:00', status:'em_atendimento' },
  { id:5, cliente:'Lucia Ferreira', servico:'Consulta',    hora:'15:30', status:'agendado'       },
]

function CardMetrica({ label, valor, sublabel, cor, icone }: {
  label: string; valor: string; sublabel: string; cor: string; icone: string
}) {
  return (
    <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'22px 24px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <p style={{ fontSize:'12px', fontWeight:'500', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>{label}</p>
          <p style={{ fontSize:'28px', fontWeight:'700', color:'#1a1a2e', letterSpacing:'-1px', lineHeight:1 }}>{valor}</p>
          <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'6px' }}>{sublabel}</p>
        </div>
        <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:cor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>
          {icone}
        </div>
      </div>
    </div>
  )
}

function GraficoFaturamento({ recharts }: { recharts: any }) {
  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={dadosFaturamento}>
        <defs>
          <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15}/>
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8"/>
        <XAxis dataKey="dia" tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `R$${(v/1000).toFixed(1)}k`}/>
        <Tooltip
          formatter={(v: number) => [formatarMoeda(v), 'Faturamento']}
          contentStyle={{ borderRadius:'10px', border:'1px solid #f0f0f8', fontSize:'13px' }}/>
        <Area type="monotone" dataKey="valor" stroke="#6366f1" strokeWidth={2} fill="url(#gradFat)"/>
      </AreaChart>
    </ResponsiveContainer>
  )
}

function GraficoServicos({ recharts }: { recharts: any }) {
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={servicosTop} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" horizontal={false}/>
        <XAxis type="number" tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false}/>
        <YAxis dataKey="nome" type="category" tick={{ fontSize:11, fill:'#374151' }} axisLine={false} tickLine={false} width={120}/>
        <Tooltip contentStyle={{ borderRadius:'10px', border:'1px solid #f0f0f8', fontSize:'13px' }}/>
        <Bar dataKey="total" fill="#6366f1" radius={[0,4,4,0]}/>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function DashboardPage() {
  const [recharts, setRecharts] = useState<any>(null)

  useEffect(() => {
    import('recharts').then(mod => setRecharts(mod))
  }, [])

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday:'long', day:'numeric', month:'long', year:'numeric',
    timeZone:'America/Sao_Paulo',
  })

  return (
    <div style={{ padding:'32px' }}>
      <div style={{ marginBottom:'28px' }}>
        <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#1a1a2e', letterSpacing:'-0.5px' }}>Dashboard</h1>
        <p style={{ fontSize:'14px', color:'#9ca3af', marginTop:'4px', textTransform:'capitalize' }}>{hoje}</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'16px', marginBottom:'24px' }}>
        <CardMetrica label="Agendamentos hoje"  valor="12"       sublabel="3 confirmados"          cor="#eef2ff" icone="📅" />
        <CardMetrica label="Clientes ativos"    valor="284"      sublabel="+8 este mês"            cor="#ecfdf5" icone="👥" />
        <CardMetrica label="Faturamento mensal" valor="R$ 18.4k" sublabel="↑ 12% vs mês anterior"  cor="#fffbeb" icone="💰" />
        <CardMetrica label="Ticket médio"       valor="R$ 148"   sublabel="Por atendimento"         cor="#fdf4ff" icone="📊" />
      </div>

      {recharts && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:'16px', marginBottom:'24px' }}>
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e' }}>Faturamento</h2>
                <p style={{ fontSize:'13px', color:'#9ca3af' }}>Últimos 12 dias</p>
              </div>
              <span style={{ fontSize:'13px', color:'#10b981', fontWeight:'500', background:'#ecfdf5', padding:'4px 10px', borderRadius:'99px' }}>↑ 12%</span>
            </div>
            <GraficoFaturamento recharts={recharts} />
          </div>

          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
            <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'4px' }}>Serviços populares</h2>
            <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'20px' }}>Este mês</p>
            <GraficoServicos recharts={recharts} />
          </div>
        </div>
      )}

      <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e' }}>Próximos agendamentos</h2>
          <a href="/dashboard/agenda" style={{ fontSize:'13px', color:'#6366f1', textDecoration:'none', fontWeight:'500' }}>
            Ver agenda completa →
          </a>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'500px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #f3f4f6' }}>
                {['Horário','Cliente','Serviço','Status'].map(col => (
                  <th key={col} style={{ padding:'8px 12px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proximosAgendamentos.map(a => (
                <tr key={a.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                  <td style={{ padding:'12px' }}>
                    <span style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', fontFamily:'monospace' }}>{a.hora}</span>
                  </td>
                  <td style={{ padding:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'600', color:'#6366f1', flexShrink:0 }}>
                        {a.cliente.split(' ').map((n:string)=>n[0]).slice(0,2).join('')}
                      </div>
                      <span style={{ fontSize:'14px', color:'#1a1a2e', fontWeight:'500' }}>{a.cliente}</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px', fontSize:'14px', color:'#6b7280' }}>{a.servico}</td>
                  <td style={{ padding:'12px' }}>
                    <span className={corStatus(a.status)} style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'99px', fontWeight:'500' }}>
                      {labelStatus(a.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
