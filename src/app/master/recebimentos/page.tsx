'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'

const inp = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const, minHeight:'42px' }

function formVazio(empresaId: string) {
  const hoje = new Date()
  const venc = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 5)
  return {
    empresa_id: empresaId,
    valor: '',
    vencimento: venc.toISOString().slice(0,10),
    pago: false,
    data_pagamento: '',
    forma_pagamento: '',
    observacoes: '',
  }
}

const FORMAS = [
  { value:'', label:'Selecione' },
  { value:'pix', label:'PIX' },
  { value:'transferencia', label:'Transferência' },
  { value:'boleto', label:'Boleto' },
  { value:'cartao_credito', label:'Cartão de Crédito' },
  { value:'dinheiro', label:'Dinheiro' },
  { value:'outro', label:'Outro' },
]

export default function RecebimentosPage() {
  const router = useRouter()
  const { usuario, carregando: carregandoCtx } = useEmpresa()
  const [empresas, setEmpresas] = useState<any[]>([])
  const [recebimentos, setRecebimentos] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos'|'pago'|'pendente'|'atrasado'>('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [selecionado, setSelecionado] = useState<any>(null)
  const [form, setForm] = useState(formVazio(''))
  const [modalGerar, setModalGerar] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [resultadoGerar, setResultadoGerar] = useState<{gerados:number; ignorados:Array<{empresa:string;mes:string}>} | null>(null)
  const hoje0 = new Date()
  const [formGerar, setFormGerar] = useState({
    mesInicial: `${hoje0.getFullYear()}-${String(hoje0.getMonth()+1).padStart(2,'0')}`,
    mesFinal: `${hoje0.getFullYear()}-${String(hoje0.getMonth()+1).padStart(2,'0')}`,
    empresaIds: [] as string[],
  })

  const ehLucas = usuario?.email === 'lucas@fortitude.com'

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const [{ data: emps }, { data: recs }] = await Promise.all([
      sb.from('empresas').select('id,nome,valor_mensal,dia_vencimento').order('nome'),
      sb.from('recebimentos_master').select('*').order('vencimento', { ascending: false }),
    ])
    setEmpresas(emps || [])
    setRecebimentos(recs || [])
    setCarregando(false)
  }, [])

  useEffect(() => { if (ehLucas) carregar() }, [carregar, ehLucas])

  useEffect(() => {
    function onKey(e: any) { if (e.key === 'Escape' && modalAberto) fecharModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalAberto])

  const empMap: Record<string,string> = {}
  empresas.forEach(e => { empMap[e.id] = e.nome })

  const hojeISO = new Date().toISOString().slice(0,10)

  function getStatus(r: any) {
    if (r.pago) return 'pago'
    if (r.vencimento < hojeISO) return 'atrasado'
    return 'pendente'
  }

  const filtrados = recebimentos.filter(r => {
    const status = getStatus(r)
    if (filtroStatus !== 'todos' && status !== filtroStatus) return false
    if (filtroEmpresa && r.empresa_id !== filtroEmpresa) return false
    if (busca) {
      const nomeEmp = (empMap[r.empresa_id] || '').toLowerCase()
      if (!nomeEmp.includes(busca.toLowerCase())) return false
    }
    return true
  })

  // Resumo
  const totalPago = recebimentos.filter(r => getStatus(r) === 'pago').reduce((s,r) => s + Number(r.valor), 0)
  const totalPendente = recebimentos.filter(r => getStatus(r) === 'pendente').reduce((s,r) => s + Number(r.valor), 0)
  const totalAtrasado = recebimentos.filter(r => getStatus(r) === 'atrasado').reduce((s,r) => s + Number(r.valor), 0)
  const countAtrasado = recebimentos.filter(r => getStatus(r) === 'atrasado').length

  function abrirNovo() {
    setModoEdicao(false)
    setSelecionado(null)
    setErro('')
    setForm(formVazio(empresas[0]?.id || ''))
    setModalAberto(true)
  }

  function abrirEdicao(r: any) {
    setModoEdicao(true)
    setSelecionado(r)
    setErro('')
    setForm({
      empresa_id: r.empresa_id,
      valor: String(r.valor),
      vencimento: r.vencimento,
      pago: r.pago,
      data_pagamento: r.data_pagamento || '',
      forma_pagamento: r.forma_pagamento || '',
      observacoes: r.observacoes || '',
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setErro('')
  }

  async function salvar() {
    if (!form.empresa_id) { setErro('Selecione a empresa.'); return }
    if (!form.valor || parseFloat(form.valor) <= 0) { setErro('Informe um valor válido.'); return }
    if (!form.vencimento) { setErro('Informe a data de vencimento.'); return }
    setSalvando(true)
    const sb = createClient()
    const payload: any = {
      empresa_id: form.empresa_id,
      valor: parseFloat(form.valor),
      vencimento: form.vencimento,
      pago: form.pago,
      data_pagamento: form.pago ? (form.data_pagamento || hojeISO) : null,
      forma_pagamento: form.pago ? (form.forma_pagamento || null) : null,
      observacoes: form.observacoes || null,
      updated_at: new Date().toISOString(),
    }
    let error: any
    if (modoEdicao && selecionado) {
      const r = await sb.from('recebimentos_master').update(payload).eq('id', selecionado.id)
      error = r.error
    } else {
      const r = await sb.from('recebimentos_master').insert(payload)
      error = r.error
    }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar()
    fecharModal()
    setSalvando(false)
  }

  async function marcarPago(r: any) {
    const sb = createClient()
    await sb.from('recebimentos_master').update({
      pago: true,
      data_pagamento: hojeISO,
      forma_pagamento: r.forma_pagamento || 'pix',
      updated_at: new Date().toISOString(),
    }).eq('id', r.id)
    await carregar()
  }

  async function desmarcarPago(r: any) {
    const sb = createClient()
    await sb.from('recebimentos_master').update({
      pago: false,
      data_pagamento: null,
      updated_at: new Date().toISOString(),
    }).eq('id', r.id)
    await carregar()
  }

  async function excluir(r: any) {
    if (!confirm('Excluir este recebimento?')) return
    const sb = createClient()
    await sb.from('recebimentos_master').delete().eq('id', r.id)
    await carregar()
  }

  async function gerarProximoMes(r: any) {
    const sb = createClient()
    const venc = new Date(r.vencimento + 'T12:00:00')
    venc.setMonth(venc.getMonth() + 1)
    await sb.from('recebimentos_master').insert({
      empresa_id: r.empresa_id,
      valor: r.valor,
      vencimento: venc.toISOString().slice(0,10),
      pago: false,
    })
    await carregar()
  }

  function abrirModalGerar() {
    setResultadoGerar(null)
    setFormGerar(f => ({ ...f, empresaIds: empresas.filter(e => e.valor_mensal).map(e => e.id) }))
    setModalGerar(true)
  }

  async function gerarParcelas() {
    setGerando(true)
    setResultadoGerar(null)
    const sb = createClient()

    const [anoIni, mesIni] = formGerar.mesInicial.split('-').map(Number)
    const [anoFim, mesFim] = formGerar.mesFinal.split('-').map(Number)

    // Lista de meses no intervalo (inclusive)
    const meses: Array<{ano:number; mes:number}> = []
    let ano = anoIni, mes = mesIni
    while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
      meses.push({ ano, mes })
      mes++
      if (mes > 12) { mes = 1; ano++ }
      if (meses.length > 120) break // limite de segurança
    }

    const empresasSelecionadas = empresas.filter(e => formGerar.empresaIds.includes(e.id) && e.valor_mensal)

    let gerados = 0
    const ignorados: Array<{empresa:string; mes:string}> = []
    const novos: any[] = []

    for (const emp of empresasSelecionadas) {
      const dia = emp.dia_vencimento || 5
      for (const { ano: a, mes: m } of meses) {
        // Calcular vencimento - ajustar dia se o mes nao tiver esse dia (ex: dia 31 em fevereiro)
        const ultimoDia = new Date(a, m, 0).getDate()
        const diaFinal = Math.min(dia, ultimoDia)
        const vencimento = `${a}-${String(m).padStart(2,'0')}-${String(diaFinal).padStart(2,'0')}`

        // Verificar se já existe parcela desta empresa para este mes/ano
        const jaExiste = recebimentos.some(r =>
          r.empresa_id === emp.id &&
          r.vencimento.slice(0,4) === String(a) &&
          r.vencimento.slice(5,7) === String(m).padStart(2,'0')
        ) || novos.some(r =>
          r.empresa_id === emp.id &&
          r.vencimento.slice(0,7) === `${a}-${String(m).padStart(2,'0')}`
        )

        if (jaExiste) {
          const nomeMes = new Date(a, m-1, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' })
          ignorados.push({ empresa: emp.nome, mes: nomeMes })
          continue
        }

        novos.push({
          empresa_id: emp.id,
          valor: emp.valor_mensal,
          vencimento,
          pago: false,
        })
      }
    }

    if (novos.length > 0) {
      const { error } = await sb.from('recebimentos_master').insert(novos)
      if (error) { alert('Erro ao gerar: ' + error.message); setGerando(false); return }
      gerados = novos.length
    }

    await carregar()
    setResultadoGerar({ gerados, ignorados })
    setGerando(false)
  }


  if (carregandoCtx) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ width:'36px', height:'36px', border:'3px solid #eef2ff', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!ehLucas) {
    return (
      <div style={{ padding:'40px 24px', textAlign:'center' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#1a1a2e', marginBottom:'6px' }}>Acesso restrito</h2>
        <p style={{ fontSize:'13px', color:'#9ca3af' }}>Esta área é exclusiva do administrador do sistema.</p>
      </div>
    )
  }

  return (
    <div style={{ padding:'16px', minHeight:'100vh', background:'#f4f5fb', boxSizing:'border-box' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={()=>router.push('/dashboard')} style={{ display:'flex', alignItems:'center', gap:'6px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', cursor:'pointer', color:'#374151', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <div style={{ flex:1, minWidth:'140px' }}>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#1a1a2e' }}>Recebimentos</h1>
          <p style={{ fontSize:'12px', color:'#9ca3af' }}>Controle de pagamentos do sistema pelas empresas</p>
        </div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', width:'100%', }}>
          <button onClick={abrirModalGerar} style={{ flex:'1 1 160px', background:'#eef2ff', color:'#6366f1', border:'1px solid #c7d2fe', borderRadius:'8px', padding:'9px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', whiteSpace:'nowrap' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
            Gerar parcelas
          </button>
          <button onClick={abrirNovo} style={{ flex:'1 1 160px', background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>
            + Novo recebimento
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:'10px', marginBottom:'18px' }}>
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 16px', minWidth:0 }}>
          <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'4px' }}>Recebido</p>
          <p style={{ fontSize:'19px', fontWeight:'800', color:'#059669', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>R$ {totalPago.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
        </div>
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 16px', minWidth:0 }}>
          <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'4px' }}>Pendente</p>
          <p style={{ fontSize:'19px', fontWeight:'800', color:'#d97706', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>R$ {totalPendente.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
        </div>
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid '+(countAtrasado>0?'#fecaca':'#f0f0f8'), padding:'14px 16px', minWidth:0 }}>
          <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'4px' }}>Atrasado {countAtrasado>0 && `(${countAtrasado})`}</p>
          <p style={{ fontSize:'19px', fontWeight:'800', color:'#ef4444', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>R$ {totalAtrasado.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar empresa..."
          style={{ ...inp, flex:'1 1 180px', maxWidth:'100%' }}/>
        <select value={filtroEmpresa} onChange={e=>setFiltroEmpresa(e.target.value)} style={{ ...inp, flex:'1 1 160px', maxWidth:'100%', background:'white' }}>
          <option value="">Todas as empresas</option>
          {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <div style={{ display:'flex', gap:'6px', overflowX:'auto', width:'100%', paddingBottom:'2px' }}>
          {([
            { key:'todos', label:'Todos' },
            { key:'pago', label:'Pagos' },
            { key:'pendente', label:'Pendentes' },
            { key:'atrasado', label:'Atrasados' },
          ] as const).map(op => (
            <button key={op.key} onClick={()=>setFiltroStatus(op.key)}
              style={{ background:filtroStatus===op.key?'#6366f1':'white', color:filtroStatus===op.key?'white':'#6b7280', border:'1px solid '+(filtroStatus===op.key?'#6366f1':'#e5e7eb'), borderRadius:'8px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'40px', textAlign:'center', color:'#9ca3af' }}>
          Nenhum recebimento encontrado
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtrados.map(r => {
            const status = getStatus(r)
            const cores = {
              pago:      { bg:'#f0fdf4', border:'#bbf7d0', badge:'#d1fae5', badgeText:'#065f46', label:'Pago' },
              pendente:  { bg:'#fffbeb', border:'#fde68a', badge:'#fef3c7', badgeText:'#92400e', label:'Pendente' },
              atrasado:  { bg:'#fef2f2', border:'#fecaca', badge:'#fee2e2', badgeText:'#991b1b', label:'Atrasado' },
            }[status]
            return (
              <div key={r.id} style={{ background:cores.bg, border:'1px solid '+cores.border, borderRadius:'12px', padding:'14px 16px', display:'flex', alignItems:'flex-start', gap:'12px', flexWrap:'wrap' }}>
                <div style={{ flex:'1 1 200px', minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                    <p style={{ fontSize:'15px', fontWeight:'700', color:'#111827', overflowWrap:'break-word' }}>{empMap[r.empresa_id] || 'Empresa'}</p>
                    <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 9px', borderRadius:'99px', background:cores.badge, color:cores.badgeText, whiteSpace:'nowrap' }}>{cores.label}</span>
                  </div>
                  <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'12px', color:'#6b7280' }}>Vencimento: {new Date(r.vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    {r.pago && r.data_pagamento && (
                      <span style={{ fontSize:'12px', color:'#059669' }}>Pago em: {new Date(r.data_pagamento+'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    )}
                    {r.pago && r.forma_pagamento && (
                      <span style={{ fontSize:'12px', color:'#6b7280', textTransform:'capitalize' }}>{r.forma_pagamento.replace('_',' ')}</span>
                    )}
                  </div>
                  {r.observacoes && <p style={{ fontSize:'12px', color:'#9ca3af', marginTop:'4px', overflowWrap:'break-word' }}>{r.observacoes}</p>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'8px', marginLeft:'auto' }}>
                  <p style={{ fontSize:'19px', fontWeight:'800', color:'#1a1a2e', whiteSpace:'nowrap' }}>R$ {Number(r.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
                </div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', width:'100%' }}>
                  {!r.pago ? (
                    <button onClick={()=>marcarPago(r)} style={{ background:'#059669', color:'white', border:'none', borderRadius:'8px', padding:'8px 14px', fontSize:'12px', fontWeight:'600', cursor:'pointer', flex:'1 1 auto', whiteSpace:'nowrap' }}>
                      Marcar pago
                    </button>
                  ) : (
                    <button onClick={()=>desmarcarPago(r)} style={{ background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'8px', padding:'8px 14px', fontSize:'12px', fontWeight:'600', cursor:'pointer', flex:'1 1 auto', whiteSpace:'nowrap' }}>
                      Desfazer
                    </button>
                  )}
                  <button onClick={()=>gerarProximoMes(r)} title="Gerar cobrança do próximo mês" style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'8px', padding:'8px 14px', fontSize:'12px', fontWeight:'600', cursor:'pointer', flex:'1 1 auto', whiteSpace:'nowrap' }}>
                    + Próximo mês
                  </button>
                  <button onClick={()=>abrirEdicao(r)} style={{ background:'#f3f4f6', color:'#374151', border:'none', borderRadius:'8px', padding:'8px 14px', fontSize:'12px', fontWeight:'600', cursor:'pointer', flex:'1 1 auto', whiteSpace:'nowrap' }}>
                    Editar
                  </button>
                  <button onClick={()=>excluir(r)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'8px', padding:'8px 14px', fontSize:'12px', fontWeight:'600', cursor:'pointer', flex:'1 1 auto', whiteSpace:'nowrap' }}>
                    Excluir
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Gerar parcelas */}
      {modalGerar && (
        <div onClick={()=>setModalGerar(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'520px', padding:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
            <h3 style={{ fontSize:'16px', fontWeight:'700', marginBottom:'4px' }}>Gerar parcelas mensais</h3>
            <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'18px' }}>Cria as cobranças do período para as empresas selecionadas, usando o valor e dia de vencimento cadastrados em cada empresa.</p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Mês inicial</label>
                <input type="month" value={formGerar.mesInicial} onChange={e=>setFormGerar(f=>({...f, mesInicial:e.target.value}))} style={inp}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Mês final</label>
                <input type="month" value={formGerar.mesFinal} onChange={e=>setFormGerar(f=>({...f, mesFinal:e.target.value}))} style={inp}/>
              </div>
            </div>

            <div style={{ marginBottom:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <label style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>Empresas</label>
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={()=>setFormGerar(f=>({...f, empresaIds: empresas.filter(e=>e.valor_mensal).map(e=>e.id)}))} style={{ background:'none', border:'none', color:'#6366f1', fontSize:'12px', cursor:'pointer', fontWeight:'600' }}>Marcar todas</button>
                  <button onClick={()=>setFormGerar(f=>({...f, empresaIds: []}))} style={{ background:'none', border:'none', color:'#9ca3af', fontSize:'12px', cursor:'pointer', fontWeight:'600' }}>Desmarcar</button>
                </div>
              </div>
              <div style={{ border:'1px solid #e5e7eb', borderRadius:'10px', maxHeight:'220px', overflowY:'auto' }}>
                {empresas.map(e => {
                  const semValor = !e.valor_mensal
                  const marcado = formGerar.empresaIds.includes(e.id)
                  return (
                    <label key={e.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderBottom:'1px solid #f3f4f6', cursor:semValor?'not-allowed':'pointer', opacity:semValor?0.5:1 }}>
                      <input type="checkbox" disabled={semValor} checked={marcado}
                        onChange={()=>setFormGerar(f=>({...f, empresaIds: marcado ? f.empresaIds.filter(id=>id!==e.id) : [...f.empresaIds, e.id]}))}
                        style={{ width:'16px', height:'16px', cursor:semValor?'not-allowed':'pointer' }}/>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>{e.nome}</p>
                        {semValor ? (
                          <p style={{ fontSize:'11px', color:'#ef4444' }}>Sem valor mensal cadastrado</p>
                        ) : (
                          <p style={{ fontSize:'11px', color:'#6b7280' }}>R$ {Number(e.valor_mensal).toLocaleString('pt-BR',{minimumFractionDigits:2})} · vence dia {e.dia_vencimento || 5}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {resultadoGerar && (
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'12px 14px', marginBottom:'16px' }}>
                <p style={{ fontSize:'13px', fontWeight:'700', color:'#065f46', marginBottom:'4px' }}>
                  {resultadoGerar.gerados} {resultadoGerar.gerados === 1 ? 'parcela gerada' : 'parcelas geradas'} com sucesso!
                </p>
                {resultadoGerar.ignorados.length > 0 && (
                  <div style={{ marginTop:'8px', borderTop:'1px solid #d1fae5', paddingTop:'8px' }}>
                    <p style={{ fontSize:'12px', fontWeight:'600', color:'#92400e', marginBottom:'4px' }}>
                      Já existia boleto gerado para:
                    </p>
                    {resultadoGerar.ignorados.map((it,i) => (
                      <p key={i} style={{ fontSize:'11px', color:'#92400e' }}>• {it.empresa} — {it.mes}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button onClick={()=>setModalGerar(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', cursor:'pointer' }}>Fechar</button>
              <button onClick={gerarParcelas} disabled={gerando || formGerar.empresaIds.length===0}
                style={{ background:gerando||formGerar.empresaIds.length===0?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'600', cursor:gerando||formGerar.empresaIds.length===0?'not-allowed':'pointer' }}>
                {gerando?'Gerando...':'Gerar parcelas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'460px', padding:'24px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
            <h3 style={{ fontSize:'16px', fontWeight:'700', marginBottom:'20px' }}>{modoEdicao ? 'Editar recebimento' : 'Novo recebimento'}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Empresa</label>
                <select value={form.empresa_id} onChange={e=>setForm(f=>({...f,empresa_id:e.target.value}))} style={{ ...inp, background:'white' }}>
                  <option value="">Selecione</option>
                  {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Valor (R$)</label>
                  <input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} style={inp} placeholder="0,00"/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Vencimento</label>
                  <input type="date" value={form.vencimento} onChange={e=>setForm(f=>({...f,vencimento:e.target.value}))} style={inp}/>
                </div>
              </div>

              {/* Toggle pago */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:form.pago?'#f0fdf4':'#f9fafb', borderRadius:'10px', padding:'12px 14px', border:'1px solid '+(form.pago?'#bbf7d0':'#e5e7eb') }}>
                <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>Pagamento recebido</p>
                <div onClick={()=>setForm(f=>({...f, pago:!f.pago}))}
                  style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', flexShrink:0, background:form.pago?'#10b981':'#e5e7eb', position:'relative', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left:form.pago?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' }}/>
                </div>
              </div>

              {form.pago && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Data do pagamento</label>
                    <input type="date" value={form.data_pagamento} onChange={e=>setForm(f=>({...f,data_pagamento:e.target.value}))} style={inp}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Forma de pagamento</label>
                    <select value={form.forma_pagamento} onChange={e=>setForm(f=>({...f,forma_pagamento:e.target.value}))} style={{ ...inp, background:'white' }}>
                      {FORMAS.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Observações</label>
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} rows={2} style={{ ...inp, resize:'none' as const }} placeholder="Opcional"/>
              </div>

              {erro && <p style={{ fontSize:'13px', color:'#ef4444' }}>{erro}</p>}

              <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
                <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'600', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
