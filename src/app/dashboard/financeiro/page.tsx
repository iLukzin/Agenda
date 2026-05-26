'use client'

import { useState, useEffect } from 'react'
import { formatarMoeda } from '@/lib/supabase'

const lancamentosMock = [
  { id:1, tipo:'receita',  descricao:'Consulta — Maria Silva',      valor:150,  vencimento:'08/01', pagamento:'08/01', status:'pago',     categoria:'Consultas',  forma:'pix'           },
  { id:2, tipo:'receita',  descricao:'Avaliação — João Santos',     valor:200,  vencimento:'10/01', pagamento:'10/01', status:'pago',     categoria:'Avaliações', forma:'cartao_credito' },
  { id:3, tipo:'despesa',  descricao:'Aluguel consultório',         valor:1800, vencimento:'15/01', pagamento:null,    status:'pendente', categoria:'Fixas',      forma:null             },
  { id:4, tipo:'receita',  descricao:'Plano 8 sessões — Ana Costa', valor:720,  vencimento:'01/01', pagamento:'01/01', status:'pago',     categoria:'Planos',     forma:'pix'            },
  { id:5, tipo:'despesa',  descricao:'Material de escritório',      valor:180,  vencimento:'12/01', pagamento:'12/01', status:'pago',     categoria:'Materiais',  forma:'cartao_debito'  },
  { id:6, tipo:'receita',  descricao:'Sessão Terapêutica — Pedro',  valor:120,  vencimento:'09/01', pagamento:null,    status:'pendente', categoria:'Consultas',  forma:null             },
  { id:7, tipo:'despesa',  descricao:'Plataforma de gestão',        valor:99,   vencimento:'20/01', pagamento:null,    status:'pendente', categoria:'Software',   forma:null             },
]

const fluxoMensal = [
  { mes:'Set', receitas:12000, despesas:4200 },
  { mes:'Out', receitas:13500, despesas:4100 },
  { mes:'Nov', receitas:11800, despesas:4400 },
  { mes:'Dez', receitas:15200, despesas:4800 },
  { mes:'Jan', receitas:18400, despesas:4600 },
]

function GraficoFluxo({ recharts }: { recharts: any }) {
  const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = recharts
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={fluxoMensal}>
        <defs>
          <linearGradient id="gradR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gradD" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8"/>
        <XAxis dataKey="mes" tick={{ fontSize:12, fill:'#9ca3af' }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `R$${(v/1000).toFixed(0)}k`}/>
        <Tooltip
          formatter={(v: number, name: string) => [formatarMoeda(v), name==='receitas'?'Receitas':'Despesas']}
          contentStyle={{ borderRadius:'10px', border:'1px solid #f0f0f8', fontSize:'13px' }}/>
        <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fill="url(#gradR)"/>
        <Area type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} fill="url(#gradD)"/>
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function FinanceiroPage() {
  const [aba, setAba]         = useState<'lancamentos'|'relatorios'>('lancamentos')
  const [tipo, setTipo]       = useState<'todos'|'receita'|'despesa'>('todos')
  const [recharts, setRecharts] = useState<any>(null)

  useEffect(() => {
    import('recharts').then(mod => setRecharts(mod))
  }, [])

  const receitas  = lancamentosMock.filter(l => l.tipo==='receita' && l.status==='pago').reduce((s,l) => s+l.valor, 0)
  const despesas  = lancamentosMock.filter(l => l.tipo==='despesa' && l.status==='pago').reduce((s,l) => s+l.valor, 0)
  const pendentes = lancamentosMock.filter(l => l.status==='pendente').reduce((s,l) => s+l.valor, 0)
  const lucro     = receitas - despesas
  const filtrados = lancamentosMock.filter(l => tipo==='todos' || l.tipo===tipo)

  return (
    <div style={{ padding:'32px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#1a1a2e', letterSpacing:'-0.5px' }}>Financeiro</h1>
          <p style={{ fontSize:'14px', color:'#9ca3af' }}>Janeiro 2024</p>
        </div>
        <button style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo lançamento
        </button>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'16px', marginBottom:'24px' }}>
        {[
          { label:'Receitas',      valor:receitas,  cor:'#ecfdf5', corText:'#10b981', icone:'↑' },
          { label:'Despesas',      valor:despesas,  cor:'#fef2f2', corText:'#ef4444', icone:'↓' },
          { label:'Lucro líquido', valor:lucro,     cor:'#eef2ff', corText:'#6366f1', icone:'◈' },
          { label:'A receber',     valor:pendentes, cor:'#fffbeb', corText:'#f59e0b', icone:'⏳' },
        ].map(card => (
          <div key={card.label} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'20px 22px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
              <p style={{ fontSize:'12px', fontWeight:'500', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{card.label}</p>
              <span style={{ width:'30px', height:'30px', borderRadius:'8px', background:card.cor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', color:card.corText, fontWeight:'700' }}>{card.icone}</span>
            </div>
            <p style={{ fontSize:'22px', fontWeight:'700', color:card.corText }}>{formatarMoeda(card.valor)}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', marginBottom:'20px', borderBottom:'2px solid #f3f4f6' }}>
        {[['lancamentos','Lançamentos'],['relatorios','Relatórios']].map(([v,l]) => (
          <button key={v} onClick={() => setAba(v as any)} style={{
            padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontSize:'14px',
            fontWeight: aba===v?'600':'400', color: aba===v?'#6366f1':'#9ca3af',
            borderBottom: aba===v?'2px solid #6366f1':'2px solid transparent', marginBottom:'-2px',
          }}>{l}</button>
        ))}
      </div>

      {aba === 'lancamentos' && (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
            {[['todos','Todos'],['receita','Receitas'],['despesa','Despesas']].map(([v,l]) => (
              <button key={v} onClick={() => setTipo(v as any)} style={{
                padding:'6px 16px', borderRadius:'99px', fontSize:'13px', fontWeight:'500', cursor:'pointer',
                border: tipo===v?'1px solid #6366f1':'1px solid #e5e7eb',
                background: tipo===v?'#eef2ff':'white', color: tipo===v?'#6366f1':'#6b7280',
              }}>{l}</button>
            ))}
          </div>
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
              <thead>
                <tr style={{ background:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
                  {['Descrição','Categoria','Vencimento','Pagamento','Valor','Status',''].map(c => (
                    <th key={c} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => (
                  <tr key={l.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                    <td style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'30px', height:'30px', borderRadius:'8px', flexShrink:0, background:l.tipo==='receita'?'#ecfdf5':'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', color:l.tipo==='receita'?'#10b981':'#ef4444' }}>
                          {l.tipo==='receita'?'↑':'↓'}
                        </div>
                        <span style={{ fontSize:'14px', color:'#1a1a2e', fontWeight:'500' }}>{l.descricao}</span>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px', fontSize:'13px', color:'#6b7280' }}>{l.categoria}</td>
                    <td style={{ padding:'14px 16px', fontSize:'13px', color:'#6b7280', fontFamily:'monospace' }}>{l.vencimento}</td>
                    <td style={{ padding:'14px 16px', fontSize:'13px', color:'#6b7280', fontFamily:'monospace' }}>{l.pagamento ?? '—'}</td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ fontSize:'14px', fontWeight:'600', color:l.tipo==='receita'?'#10b981':'#ef4444' }}>
                        {l.tipo==='receita'?'+':'-'}{formatarMoeda(l.valor)}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:l.status==='pago'?'#ecfdf5':'#fffbeb', color:l.status==='pago'?'#10b981':'#f59e0b' }}>
                        {l.status==='pago'?'Pago':'Pendente'}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <button style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>⋯</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'relatorios' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'4px' }}>Fluxo de caixa — últimos 5 meses</h2>
          <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'20px' }}>Receitas vs Despesas</p>
          {recharts
            ? <GraficoFluxo recharts={recharts} />
            : <div style={{ height:'280px', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:'14px' }}>Carregando gráfico...</div>
          }
        </div>
      )}
    </div>
  )
}
