// BUILD: 1781600000000
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePermissao } from '@/hooks/usePermissao'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/supabase'
import StickyPageHeader from '@/components/StickyPageHeader'

type Lancamento = {
  id: string; tipo: 'receita'|'despesa'; descricao: string
  valor: number; data_vencimento: string; data_pagamento: string|null
  status: 'pago'|'pendente'|'cancelado'; categoria: string
  forma_pagamento: string|null; cliente_id: string|null; cliente_nome: string
  origem: 'manual'|'agendamento'; observacoes: string
}
type AgFinalizado = {
  id: string; data_inicio: string; valor: number; valor_bruto: number; desconto: number; cliente: string; servico: string
}
type Categoria = {
  id: string; tipo: 'receita'|'despesa'; nome: string; ativo: boolean; ordem: number
}

const inputStyle = { width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'10px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const, background:'white' }
const CATEGORIAS_REC_PADRAO = ['Consultas','Avaliações','Planos','Sessões','Outros']
const CATEGORIAS_DES_PADRAO = ['Aluguel','Salários','Material','Software','Marketing','Impostos','Manutenção','Outros']
const FORMAS = ['','Dinheiro','PIX','Cartão de crédito','Cartão de débito','Transferência','Boleto','Plano']

function padISO(n: number) { return String(n).padStart(2,'0') }
function hojeISO() { const d=new Date(); return `${d.getFullYear()}-${padISO(d.getMonth()+1)}-${padISO(d.getDate())}` }
function inicioMes(){ const d=new Date(); return `${d.getFullYear()}-${padISO(d.getMonth()+1)}-01` }
function fimMes()   { const d=new Date(); const f=new Date(d.getFullYear(),d.getMonth()+1,0); return `${f.getFullYear()}-${padISO(f.getMonth()+1)}-${padISO(f.getDate())}` }
function inicioAno(){ const d=new Date(); return `${d.getFullYear()}-01-01` }
function fimAno()   { const d=new Date(); return `${d.getFullYear()}-12-31` }
function fmtData(iso: string) { return iso ? new Date(iso+'T12:00:00').toLocaleDateString('pt-BR') : '-' }

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

export default function FinanceiroPage() {
  const perm = usePermissao('financeiro')
  const { empresaAtiva, isMaster } = useEmpresa()

  const moduloHabilitado = isMaster || empresaAtiva?.financeiro_habilitado === true
  const temAcesso = moduloHabilitado && perm.visualizar

  const podeCriar = isMaster || perm.criar
  const podeAlterar = isMaster || perm.alterar
  const podeExcluir = isMaster || perm.excluir

  // ────────────────────────────────────────────────────────────
  // TODOS os hooks ficam aqui, antes de qualquer return condicional,
  // para nunca violar a regra de hooks do React (erro #310)
  // ────────────────────────────────────────────────────────────
  const [lancamentos, setLancamentos]   = useState<Lancamento[]>([])
  const [agsFinalizados, setAgsFinalizados] = useState<AgFinalizado[]>([])
  const [clientes, setClientes]         = useState<{id:string;nome:string}[]>([])
  const [categorias, setCategorias]     = useState<Categoria[]>([])
  const [carregando, setCarregando]     = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [aba, setAba] = useState<'visao_geral'|'receber'|'pagar'|'pagas'|'relatorio'>('visao_geral')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Lancamento|null>(null)
  const [erro, setErro]                 = useState('')
  const [busca, setBusca]               = useState('')

  const [modalQuitar, setModalQuitar] = useState(false)
  const [quitarSel, setQuitarSel] = useState<Lancamento|null>(null)
  const [formQuitar, setFormQuitar] = useState({ data_pagamento:'', forma_pagamento:'Dinheiro' })
  const [salvandoQuitar, setSalvandoQuitar] = useState(false)

  const [modalCategorias, setModalCategorias] = useState(false)
  const [tipoCategoriaModal, setTipoCategoriaModal] = useState<'receita'|'despesa'>('receita')
  const [novaCategoria, setNovaCategoria] = useState('')
  const [salvandoCategoria, setSalvandoCategoria] = useState(false)
  const [editandoCategoriaId, setEditandoCategoriaId] = useState('')
  const [editandoCategoriaNome, setEditandoCategoriaNome] = useState('')

  const [modalDRE, setModalDRE] = useState(false)
  const [gerandoDRE, setGerandoDRE] = useState(false)
  const [dreFiltroTipo, setDreFiltroTipo] = useState<'hoje'|'mes'|'ano'|'periodo'>('mes')
  const [dreIni, setDreIni] = useState(inicioMes())
  const [dreFim, setDreFim] = useState(fimMes())
  const [dreCriterio, setDreCriterio] = useState<'vencimento'|'pagamento'>('pagamento')

  const [filtroTipo, setFiltroTipo] = useState<'hoje'|'mes'|'ano'|'periodo'>('hoje')
  const [periodoIni, setPeriodoIni] = useState(hojeISO())
  const [periodoFim, setPeriodoFim] = useState(hojeISO())
  const [filtroData, setFiltroData] = useState<'vencimento'|'pagamento'>('pagamento')

  const [form, setForm] = useState({
    tipo: 'receita' as 'receita'|'despesa',
    descricao:'', valor:'', categoria:'Consultas',
    data_vencimento:hojeISO(), data_pagamento:'',
    status:'pendente' as 'pago'|'pendente', forma_pagamento:'', cliente_id:'', observacoes:'',
  })

  useEffect(() => {
    if (filtroTipo==='hoje')   { setPeriodoIni(hojeISO());   setPeriodoFim(hojeISO()) }
    if (filtroTipo==='mes')    { setPeriodoIni(inicioMes()); setPeriodoFim(fimMes()) }
    if (filtroTipo==='ano')    { setPeriodoIni(inicioAno()); setPeriodoFim(fimAno()) }
  }, [filtroTipo])

  useEffect(() => {
    if (dreFiltroTipo==='hoje')   { setDreIni(hojeISO());   setDreFim(hojeISO()) }
    if (dreFiltroTipo==='mes')    { setDreIni(inicioMes()); setDreFim(fimMes()) }
    if (dreFiltroTipo==='ano')    { setDreIni(inicioAno()); setDreFim(fimAno()) }
  }, [dreFiltroTipo])

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id || !temAcesso) return
    setCarregando(true)
    const sb = createClient()

    // Busca lançamentos cujo vencimento OU pagamento caia no período,
    // e filtra no cliente conforme o critério escolhido (filtroData)
    const [{ data: lansVenc }, { data: lansPag }, { data: ags }, { data: cls }, { data: cats }] = await Promise.all([
      sb.from('lancamentos')
        .select('id,tipo,descricao,valor,data_vencimento,data_pagamento,status,categoria,forma_pagamento,cliente_id,origem,observacoes')
        .eq('empresa_id', empresaAtiva.id)
        .gte('data_vencimento', periodoIni)
        .lte('data_vencimento', periodoFim),
      sb.from('lancamentos')
        .select('id,tipo,descricao,valor,data_vencimento,data_pagamento,status,categoria,forma_pagamento,cliente_id,origem,observacoes')
        .eq('empresa_id', empresaAtiva.id)
        .gte('data_pagamento', periodoIni)
        .lte('data_pagamento', periodoFim),
      sb.from('agendamentos')
        .select('id,data_inicio,valor,valor_bruto,desconto,status,cliente_id,servico_id')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'fechado')
        .gte('data_inicio', periodoIni+'T00:00:00')
        .lte('data_inicio', periodoFim+'T23:59:59')
        .order('data_inicio', { ascending:false }),
      sb.from('clientes').select('id,nome').eq('empresa_id', empresaAtiva.id).order('nome'),
      sb.from('categorias_financeiro').select('id,tipo,nome,ativo,ordem').eq('empresa_id', empresaAtiva.id).order('ordem'),
    ])

    setCategorias((cats||[]) as Categoria[])

    const cliMap:  Record<string,string> = {}
    const servMap: Record<string,string> = {}
    ;(cls||[]).forEach((c:any) => { cliMap[c.id] = c.nome })
    setClientes(cls||[])

    if (ags && ags.length > 0) {
      const servIds = Array.from(new Set(ags.map((a:any) => a.servico_id).filter(Boolean)))
      if (servIds.length > 0) {
        const { data: servs } = await sb.from('servicos').select('id,nome').in('id', servIds as string[])
        ;(servs||[]).forEach((s:any) => { servMap[s.id] = s.nome })
      }
    }

    // Une os dois conjuntos sem duplicar, mantendo todos os lançamentos que
    // tocam o período por qualquer um dos dois critérios
    const todosMap: Record<string,any> = {}
    ;(lansVenc||[]).forEach((l:any) => { todosMap[l.id] = l })
    ;(lansPag||[]).forEach((l:any) => { todosMap[l.id] = l })
    const todosLans = Object.values(todosMap)

    setLancamentos(todosLans.map((l:any) => ({
      ...l, cliente_nome: l.cliente_id?(cliMap[l.cliente_id]||''):'', origem:l.origem||'manual', observacoes: l.observacoes || '',
    })) as Lancamento[])
    setAgsFinalizados((ags||[]).map((a:any) => ({
      id:a.id, data_inicio:a.data_inicio, valor:a.valor||0, desconto:a.desconto||0, valor_bruto:a.valor_bruto||a.valor||0,
      cliente:cliMap[a.cliente_id]||'--', servico:servMap[a.servico_id]||'--',
    })))
    setCarregando(false)
  }, [empresaAtiva?.id, periodoIni, periodoFim, temAcesso])

  useEffect(() => { carregar() }, [carregar])
  useVisibilityRefresh(carregar)

  // ────────────────────────────────────────────────────────────
  // Guards de acesso — agora depois de todos os hooks
  // ────────────────────────────────────────────────────────────
  if (!perm.carregando && moduloHabilitado && !perm.visualizar) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <p style={{ fontSize:'16px', fontWeight:'700', color:'#374151' }}>Acesso não permitido</p>
        <p style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', maxWidth:'320px' }}>Você não tem permissão para acessar o módulo financeiro. Fale com o administrador da sua empresa.</p>
      </div>
    )
  }

  if (!perm.carregando && !moduloHabilitado) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px', padding:'24px' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#f5f3ff', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <p style={{ fontSize:'16px', fontWeight:'700', color:'#374151' }}>Módulo Financeiro não habilitado</p>
        <p style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', maxWidth:'340px' }}>Este recurso ainda não foi liberado para a sua empresa. Solicite a ativação ao administrador do sistema.</p>
      </div>
    )
  }

  if (perm.carregando) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ width:'36px', height:'36px', border:'3px solid #eef2ff', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // Aplica o critério de período escolhido: vencimento ou pagamento.
  // A busca já trouxe tudo que toca o período por qualquer um dos dois critérios,
  // aqui filtramos de fato pelo que o usuário escolheu ver.
  const lancamentosNoPeriodo = lancamentos.filter(l => {
    if (filtroData === 'pagamento') {
      // Só considera o que foi efetivamente pago/recebido dentro do período
      return !!l.data_pagamento && l.data_pagamento >= periodoIni && l.data_pagamento <= periodoFim
    }
    return l.data_vencimento >= periodoIni && l.data_vencimento <= periodoFim
  })

  const receitasLanc  = lancamentosNoPeriodo.filter(l=>l.tipo==='receita' && l.status==='pago').reduce((s,l)=>s+l.valor,0)
  const receitasAgs   = agsFinalizados.reduce((s,a)=>s+a.valor,0)
  const totalReceitas = receitasLanc + receitasAgs
  const totalDespesas = lancamentosNoPeriodo.filter(l=>l.tipo==='despesa' && l.status==='pago').reduce((s,l)=>s+l.valor,0)
  const lucro          = totalReceitas - totalDespesas

  // Contas pendentes (a receber/pagar) sempre seguem o vencimento, mesmo se o
  // filtro estiver em "pagamento" — não fariam sentido filtradas por uma data que não existe ainda
  const lancamentosPendentesPeriodo = filtroData === 'pagamento'
    ? lancamentos.filter(l => l.data_vencimento >= periodoIni && l.data_vencimento <= periodoFim)
    : lancamentosNoPeriodo

  const contasReceber = lancamentosPendentesPeriodo.filter(l=>l.tipo==='receita' && l.status==='pendente')
  const contasPagar   = lancamentosPendentesPeriodo.filter(l=>l.tipo==='despesa' && l.status==='pendente')
  const contasPagasLista = lancamentosNoPeriodo.filter(l=>l.status==='pago').sort((a,b)=>(b.data_pagamento||'').localeCompare(a.data_pagamento||''))

  const totalAReceber = contasReceber.reduce((s,l)=>s+l.valor,0)
  const totalAPagar   = contasPagar.reduce((s,l)=>s+l.valor,0)

  const hoje = hojeISO()
  const receberAtrasados = contasReceber.filter(l=>l.data_vencimento < hoje)
  const pagarAtrasados   = contasPagar.filter(l=>l.data_vencimento < hoje)

  function filtraBusca(lista: Lancamento[]): Lancamento[] {
    if (!busca.trim()) return lista
    const b = busca.toLowerCase()
    return lista.filter(l => (l.descricao||'').toLowerCase().includes(b) || (l.cliente_nome||'').toLowerCase().includes(b))
  }

  function abrirNovo(tipoInicial?: 'receita'|'despesa') {
    setModoEdicao(false); setSelecionado(null); setErro('')
    const t = tipoInicial||'receita'
    const catPadrao = (t==='receita' ? opcoesCategoriaReceita : opcoesCategoriaDespesa)[0] || ''
    setForm({ tipo:t, descricao:'', valor:'', categoria:catPadrao, data_vencimento:hojeISO(), data_pagamento:'', status:'pendente', forma_pagamento:'', cliente_id:'', observacoes:'' })
    setModalAberto(true)
  }
  function abrirEdicao(l: Lancamento) {
    if (l.origem==='agendamento' || !podeAlterar) return
    setModoEdicao(true); setSelecionado(l); setErro('')
    setForm({ tipo:l.tipo, descricao:l.descricao, valor:String(l.valor), categoria:l.categoria, data_vencimento:l.data_vencimento, data_pagamento:l.data_pagamento||'', status:l.status==='pago'?'pago':'pendente', forma_pagamento:l.forma_pagamento||'', cliente_id:l.cliente_id||'', observacoes:l.observacoes||'' })
    setModalAberto(true)
  }
  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.descricao.trim()||!form.valor) return setErro('Descrição e valor são obrigatórios.')
    if (parseFloat(form.valor) <= 0) return setErro('O valor deve ser maior que zero.')
    if (!empresaAtiva?.id) return
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = { tipo:form.tipo, descricao:form.descricao.trim(), valor:parseFloat(form.valor)||0, categoria:form.categoria, data_vencimento:form.data_vencimento, data_pagamento:form.data_pagamento||null, status:form.status, forma_pagamento:form.forma_pagamento||null, cliente_id:form.cliente_id||null, observacoes:form.observacoes||null, origem:'manual' }
    let error:any
    if (modoEdicao&&selecionado) { const r=await sb.from('lancamentos').update(payload).eq('id',selecionado.id); error=r.error }
    else { const r=await sb.from('lancamentos').insert({...payload,empresa_id:empresaAtiva.id}); error=r.error }
    if (error) { setErro('Erro: '+error.message); setSalvando(false); return }
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id:string) {
    if (!podeExcluir) return
    if (!confirm('Excluir este lançamento?')) return
    const sb=createClient(); await sb.from('lancamentos').delete().eq('id',id)
    await carregar(); fecharModal()
  }

  function abrirModalQuitar(l: Lancamento) {
    setQuitarSel(l)
    setFormQuitar({ data_pagamento: hojeISO(), forma_pagamento: l.forma_pagamento || 'Dinheiro' })
    setModalQuitar(true)
  }
  async function confirmarQuitacao() {
    if (!quitarSel) return
    setSalvandoQuitar(true)
    const sb = createClient()
    await sb.from('lancamentos').update({
      status:'pago',
      data_pagamento: formQuitar.data_pagamento || hojeISO(),
      forma_pagamento: formQuitar.forma_pagamento || null,
    }).eq('id', quitarSel.id)
    await carregar()
    setSalvandoQuitar(false)
    setModalQuitar(false)
    setQuitarSel(null)
  }
  async function reabrirConta(l: Lancamento) {
    if (!podeAlterar) return
    if (!confirm('Reabrir esta conta? Ela voltará para pendente e deixará de contar nos totais.')) return
    const sb = createClient()
    await sb.from('lancamentos').update({ status:'pendente', data_pagamento:null }).eq('id', l.id)
    await carregar()
  }

  // ────────────────────────────────────────────────────────────
  // Categorias por empresa
  // ────────────────────────────────────────────────────────────
  function abrirModalCategorias(tipo: 'receita'|'despesa') {
    setTipoCategoriaModal(tipo)
    setNovaCategoria('')
    setEditandoCategoriaId('')
    setEditandoCategoriaNome('')
    setModalCategorias(true)
  }

  async function criarCategoria() {
    const nome = novaCategoria.trim()
    if (!nome) return
    if (!empresaAtiva?.id) return
    const jaExiste = categorias.some(c => c.tipo===tipoCategoriaModal && c.nome.toLowerCase()===nome.toLowerCase())
    if (jaExiste) { alert('Essa categoria já existe.'); return }
    setSalvandoCategoria(true)
    const sb = createClient()
    const maiorOrdem = categorias.filter(c=>c.tipo===tipoCategoriaModal).reduce((m,c)=>Math.max(m,c.ordem||0),0)
    const { error } = await sb.from('categorias_financeiro').insert({
      empresa_id: empresaAtiva.id, tipo: tipoCategoriaModal, nome, ativo: true, ordem: maiorOrdem + 1,
    })
    if (error) { alert('Erro ao criar categoria: ' + error.message); setSalvandoCategoria(false); return }
    setNovaCategoria('')
    await carregar()
    setSalvandoCategoria(false)
  }

  function iniciarEdicaoCategoria(c: Categoria) {
    setEditandoCategoriaId(c.id)
    setEditandoCategoriaNome(c.nome)
  }

  async function salvarEdicaoCategoria() {
    const nome = editandoCategoriaNome.trim()
    if (!nome || !editandoCategoriaId) { setEditandoCategoriaId(''); return }
    const sb = createClient()
    await sb.from('categorias_financeiro').update({ nome }).eq('id', editandoCategoriaId)
    setEditandoCategoriaId('')
    await carregar()
  }

  async function alternarAtivoCategoria(c: Categoria) {
    const sb = createClient()
    await sb.from('categorias_financeiro').update({ ativo: !c.ativo }).eq('id', c.id)
    await carregar()
  }

  async function excluirCategoria(c: Categoria) {
    const emUso = lancamentos.some(l => l.categoria === c.nome)
    if (emUso) {
      if (!confirm(`A categoria "${c.nome}" já foi usada em lançamentos. Excluir só impede novos lançamentos com ela — os existentes não são afetados. Deseja continuar?`)) return
    } else {
      if (!confirm(`Excluir a categoria "${c.nome}"?`)) return
    }
    const sb = createClient()
    await sb.from('categorias_financeiro').delete().eq('id', c.id)
    await carregar()
  }

  // Lista efetiva: categorias cadastradas pela empresa (ativas), com fallback
  // para a lista padrão caso a empresa ainda não tenha cadastrado nenhuma
  const categoriasReceitaAtivas = categorias.filter(c=>c.tipo==='receita' && c.ativo).map(c=>c.nome)
  const categoriasDespesaAtivas = categorias.filter(c=>c.tipo==='despesa' && c.ativo).map(c=>c.nome)
  const opcoesCategoriaReceita = categoriasReceitaAtivas.length > 0 ? categoriasReceitaAtivas : CATEGORIAS_REC_PADRAO
  const opcoesCategoriaDespesa = categoriasDespesaAtivas.length > 0 ? categoriasDespesaAtivas : CATEGORIAS_DES_PADRAO

  function exportarExcel(lista: Lancamento[], nome: string) {
    const rows = [
      ['Tipo','Descrição','Categoria','Vencimento','Pagamento','Valor','Status','Cliente'],
      ...lista.map(l=>[
        l.tipo==='receita'?'Receita':'Despesa',
        l.descricao, l.categoria, fmtData(l.data_vencimento),
        l.data_pagamento?fmtData(l.data_pagamento):'', l.valor.toFixed(2).replace('.',','),
        l.status==='pago'?'Pago':l.status==='cancelado'?'Cancelado':'Pendente', l.cliente_nome||'',
      ]),
    ]
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n')
    const bom  = '\uFEFF'
    const blob = new Blob([bom+csv], { type:'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`${nome}_${periodoIni}_${periodoFim}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportarPDF(lista: Lancamento[], titulo: string) {
    const win = window.open('','_blank','width=900,height=700')
    if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }
    const label = filtroTipo==='hoje'?'Hoje':filtroTipo==='mes'?'Este mês':filtroTipo==='ano'?'Este ano':`${fmtData(periodoIni)} a ${fmtData(periodoFim)}`
    const total = lista.reduce((s,l)=>s + (l.tipo==='receita'?l.valor:-l.valor), 0)
    const linhas = lista.map(l=>`
      <tr>
        <td>${l.tipo==='receita'?'Receita':'Despesa'}</td>
        <td>${l.descricao}</td>
        <td>${l.categoria}</td>
        <td>${fmtData(l.data_vencimento)}</td>
        <td>${l.data_pagamento?fmtData(l.data_pagamento):'-'}</td>
        <td style="text-align:right;color:${l.tipo==='receita'?'#059669':'#dc2626'};font-weight:700">
          ${l.tipo==='receita'?'+':'-'} R$ ${l.valor.toFixed(2).replace('.',',')}
        </td>
        <td><span style="padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${l.status==='pago'?'#d1fae5':l.status==='cancelado'?'#f3f4f6':'#fef3c7'};color:${l.status==='pago'?'#065f46':l.status==='cancelado'?'#6b7280':'#92400e'}">${l.status==='pago'?'Pago':l.status==='cancelado'?'Cancelado':'Pendente'}</span></td>
      </tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;padding:28px;color:#1a1a2e}
      h1{font-size:21px;margin-bottom:4px}
      .sub{color:#9ca3af;font-size:12px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f4f5fb;padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;border-bottom:2px solid #e5e7eb}
      td{padding:9px 12px;border-bottom:1px solid #f0f0f0}
      tfoot td{font-weight:800;border-top:2px solid #e5e7eb}
      @media print{.no-print{display:none}}
    </style></head><body>
    <h1>${titulo} - AgendaFortitude</h1>
    <p class="sub">Periodo: ${label} - Gerado em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} - ${lista.length} registro(s)</p>
    <table><thead><tr><th>Tipo</th><th>Descricao</th><th>Categoria</th><th>Vencimento</th><th>Pagamento</th><th style="text-align:right">Valor</th><th>Status</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td colspan="5">TOTAL</td><td style="text-align:right;color:${total>=0?'#059669':'#dc2626'}">R$ ${total.toFixed(2).replace('.',',')}</td><td></td></tr></tfoot>
    </table>
    <br><button class="no-print" onclick="window.print()" style="padding:10px 20px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer">Imprimir / Salvar PDF</button>
    </body></html>`)
    win.document.close()
    win.onload = () => win.print()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({...p, [k]: e.target.value}))

  // ────────────────────────────────────────────────────────────
  // DRE — Demonstrativo de Resultado do Exercício
  // ────────────────────────────────────────────────────────────
  async function gerarDRE() {
    if (!empresaAtiva?.id) return
    setGerandoDRE(true)
    const sb = createClient()
    const campoData = dreCriterio === 'pagamento' ? 'data_pagamento' : 'data_vencimento'

    const [{ data: lans }, { data: ags }, { data: cls }] = await Promise.all([
      sb.from('lancamentos')
        .select('id,tipo,descricao,valor,data_vencimento,data_pagamento,status,categoria,cliente_id')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'pago')
        .gte(campoData, dreIni)
        .lte(campoData, dreFim),
      sb.from('agendamentos')
        .select('id,data_inicio,valor,valor_bruto,desconto,status,cliente_id,servico_id')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'fechado')
        .gte('data_inicio', dreIni+'T00:00:00')
        .lte('data_inicio', dreFim+'T23:59:59'),
      sb.from('clientes').select('id,nome').eq('empresa_id', empresaAtiva.id),
    ])

    const cliMap: Record<string,string> = {}
    ;(cls||[]).forEach((c:any) => { cliMap[c.id] = c.nome })

    const lansPagos = (lans||[]) as any[]
    const agsFechados = (ags||[]) as any[]

    // Agrupar receitas de lançamentos por categoria
    const receitasPorCategoria: Record<string, number> = {}
    let totalReceitasLanc = 0
    lansPagos.filter(l=>l.tipo==='receita').forEach(l => {
      const cat = l.categoria || 'Sem categoria'
      receitasPorCategoria[cat] = (receitasPorCategoria[cat]||0) + Number(l.valor)
      totalReceitasLanc += Number(l.valor)
    })

    // Agrupar despesas por categoria
    const despesasPorCategoria: Record<string, number> = {}
    let totalDespesas = 0
    lansPagos.filter(l=>l.tipo==='despesa').forEach(l => {
      const cat = l.categoria || 'Sem categoria'
      despesasPorCategoria[cat] = (despesasPorCategoria[cat]||0) + Number(l.valor)
      totalDespesas += Number(l.valor)
    })

    // Receita de atendimentos da agenda (sempre por data do atendimento, já que não tem "vencimento/pagamento" separado)
    const totalReceitaAgendamentos = agsFechados.reduce((s,a)=>s + Number(a.valor||0), 0)
    const qtdAgendamentos = agsFechados.length

    const totalReceitas = totalReceitasLanc + totalReceitaAgendamentos
    const resultado = totalReceitas - totalDespesas
    const margem = totalReceitas > 0 ? (resultado/totalReceitas*100) : 0

    const linhasReceita = Object.entries(receitasPorCategoria).sort((a,b)=>b[1]-a[1])
    const linhasDespesa = Object.entries(despesasPorCategoria).sort((a,b)=>b[1]-a[1])

    const label = dreFiltroTipo==='hoje'?'Hoje':dreFiltroTipo==='mes'?'Este mês':dreFiltroTipo==='ano'?'Este ano':`${fmtData(dreIni)} a ${fmtData(dreFim)}`
    const criterioLabel = dreCriterio === 'pagamento' ? 'Data de pagamento' : 'Data de lançamento (vencimento)'

    const linhaHtml = (nome: string, valor: number, totalRef: number, cor: string) => `
      <tr>
        <td style="padding-left:24px">${nome}</td>
        <td style="text-align:right;font-weight:600;color:${cor}">R$ ${valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;color:#9ca3af;font-size:11px">${totalRef>0?(valor/totalRef*100).toFixed(1):'0,0'}%</td>
      </tr>`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DRE - ${empresaAtiva?.nome||''}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1a1a2e;max-width:820px;margin:0 auto}
      h1{font-size:22px;margin-bottom:2px}
      h2{font-size:14px;font-weight:700;margin:0;padding:10px 14px;border-radius:8px 8px 0 0}
      .sub{color:#9ca3af;font-size:12.5px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;border:1px solid #f0f0f0;border-radius:0 0 8px 8px;overflow:hidden}
      td{padding:9px 14px;border-bottom:1px solid #f5f5f5}
      .totalrow td{font-weight:800;border-top:2px solid #e5e7eb;border-bottom:none;font-size:14px}
      .secrec h2{background:#ecfdf5;color:#065f46}
      .secdes h2{background:#fef2f2;color:#991b1b}
      .resumo{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}
      .card{border-radius:10px;padding:14px 16px}
      .card p:first-child{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px}
      .card p:last-child{font-size:19px;font-weight:800;margin:0}
      @media print{.no-print{display:none}}
    </style></head><body>
    <h1>Demonstrativo de Resultado (DRE)</h1>
    <p class="sub">${empresaAtiva?.nome||''} · Período: ${label} (${fmtData(dreIni)} a ${fmtData(dreFim)}) · Critério: ${criterioLabel} · Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>

    <div class="resumo">
      <div class="card" style="background:#ecfdf5"><p>Receita total</p><p style="color:#059669">R$ ${totalReceitas.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p></div>
      <div class="card" style="background:#fef2f2"><p>Despesa total</p><p style="color:#dc2626">R$ ${totalDespesas.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p></div>
      <div class="card" style="background:${resultado>=0?'#eef2ff':'#fef2f2'}"><p>Resultado (lucro/prejuízo)</p><p style="color:${resultado>=0?'#4f46e5':'#dc2626'}">R$ ${resultado.toLocaleString('pt-BR',{minimumFractionDigits:2})}</p></div>
    </div>

    <div class="secrec">
      <h2>Receitas</h2>
      <table>
        <tr><td style="padding-left:24px;font-weight:600">Atendimentos da agenda (${qtdAgendamentos})</td><td style="text-align:right;font-weight:600;color:#059669">R$ ${totalReceitaAgendamentos.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td style="text-align:right;color:#9ca3af;font-size:11px">${totalReceitas>0?(totalReceitaAgendamentos/totalReceitas*100).toFixed(1):'0,0'}%</td></tr>
        ${linhasReceita.map(([cat,v])=>linhaHtml(cat, v, totalReceitas, '#059669')).join('')}
        <tr class="totalrow"><td>Total de receitas</td><td style="text-align:right;color:#059669">R$ ${totalReceitas.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td></td></tr>
      </table>
    </div>

    <div class="secdes">
      <h2>Despesas</h2>
      <table>
        ${linhasDespesa.length>0 ? linhasDespesa.map(([cat,v])=>linhaHtml(cat, v, totalDespesas, '#dc2626')).join('') : '<tr><td style="padding-left:24px;color:#9ca3af">Nenhuma despesa no período</td><td></td><td></td></tr>'}
        <tr class="totalrow"><td>Total de despesas</td><td style="text-align:right;color:#dc2626">R$ ${totalDespesas.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td><td></td></tr>
      </table>
    </div>

    <table>
      <tr class="totalrow" style="background:${resultado>=0?'#eef2ff':'#fef2f2'}">
        <td style="border-radius:8px 0 0 8px">Resultado do período</td>
        <td style="text-align:right;color:${resultado>=0?'#4f46e5':'#dc2626'}">R$ ${resultado.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td style="text-align:right;font-size:12px;color:#9ca3af;border-radius:0 8px 8px 0">margem ${margem.toFixed(1)}%</td>
      </tr>
    </table>

    <br><button class="no-print" onclick="window.print()" style="padding:10px 20px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:13px;cursor:pointer">Imprimir / Salvar PDF</button>
    </body></html>`

    const win = window.open('','_blank','width=900,height=700')
    if (!win) { alert('Permita pop-ups para visualizar o DRE.'); setGerandoDRE(false); return }
    win.document.write(html)
    win.document.close()
    setGerandoDRE(false)
    setModalDRE(false)
  }

  const labelPeriodo = filtroTipo==='hoje'?'Hoje':filtroTipo==='mes'?'Este mês':filtroTipo==='ano'?`Ano ${new Date().getFullYear()}`:`${fmtData(periodoIni)} - ${fmtData(periodoFim)}`

  const abaBtnStyle = (a: string) => ({
    padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontSize:'13px',
    fontWeight: aba===a ? '700' as const : '500' as const,
    color: aba===a ? '#6366f1' : '#9ca3af',
    borderBottom: aba===a ? '2.5px solid #6366f1' : '2.5px solid transparent',
    marginBottom:'-2px', whiteSpace:'nowrap' as const,
  })

  return (
    <div style={{ padding:'12px', maxWidth:'1180px', margin:'0 auto', boxSizing:'border-box', width:'100%', overflowX:'hidden' }}>
      <StickyPageHeader>
      <div style={{ padding:'12px 12px 0' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.02em' }}>Financeiro</h1>
        <p style={{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' }}>{labelPeriodo} · {empresaAtiva?.nome}</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', padding:'8px 12px', width:'100%' }}>
        <button onClick={()=>setModalDRE(true)} style={{ background:'#eef2ff', color:'#4338ca', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.4 8.6 12 15l-3-3-3.6 3.6"/></svg>
          DRE
        </button>
        {podeCriar ? (
          <>
            <button onClick={()=>abrirModalCategorias('receita')} style={{ background:'#f4f5fb', color:'#6366f1', border:'1.5px solid #e0e3f5', borderRadius:'10px', padding:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
              Categorias
            </button>
            <button onClick={()=>abrirNovo('receita')} style={{ background:'#ecfdf5', color:'#059669', border:'1.5px solid #6ee7b7', borderRadius:'10px', padding:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              + Receita
            </button>
            <button onClick={()=>abrirNovo('despesa')} style={{ background:'#fef2f2', color:'#dc2626', border:'1.5px solid #fecaca', borderRadius:'10px', padding:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              + Despesa
            </button>
          </>
        ) : <div/>}
      </div>

      <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f0f0f8', padding:'16px 18px', marginBottom:'20px', boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
        <div style={{ marginBottom:'12px' }}>
          <span style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>Período</span>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {[['hoje','Hoje'],['mes','Este mês'],['ano','Este ano'],['periodo','Personalizado']].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltroTipo(v as any)} style={{ padding:'7px 14px', borderRadius:'99px', fontSize:'13px', fontWeight:'600', cursor:'pointer', border:filtroTipo===v?'1.5px solid #6366f1':'1px solid #e5e7eb', background:filtroTipo===v?'#eef2ff':'white', color:filtroTipo===v?'#6366f1':'#6b7280' }}>{l}</button>
            ))}
          </div>
          {filtroTipo==='periodo' && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginTop:'10px' }}>
              <input type="date" value={periodoIni} onChange={e=>setPeriodoIni(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none', maxWidth:'160px', boxSizing:'border-box' as const }}/>
              <span style={{ fontSize:'13px', color:'#9ca3af' }}>até</span>
              <input type="date" value={periodoFim} onChange={e=>setPeriodoFim(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none', maxWidth:'160px', boxSizing:'border-box' as const }}/>
            </div>
          )}
        </div>
        <div style={{ paddingTop:'12px', borderTop:'1.5px solid #f3f4f6' }}>
          <span style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>Filtrar por</span>
          <div style={{ display:'flex', gap:'4px', background:'#f4f5fb', borderRadius:'99px', padding:'4px', width:'fit-content', flexWrap:'wrap' }}>
            <button onClick={()=>setFiltroData('vencimento')} style={{ padding:'7px 15px', borderRadius:'99px', fontSize:'12.5px', fontWeight:'600', cursor:'pointer', border:'none', background:filtroData==='vencimento'?'#6366f1':'transparent', color:filtroData==='vencimento'?'white':'#6b7280', whiteSpace:'nowrap' }}>
              Data lançamento
            </button>
            <button onClick={()=>setFiltroData('pagamento')} style={{ padding:'7px 15px', borderRadius:'99px', fontSize:'12.5px', fontWeight:'600', cursor:'pointer', border:'none', background:filtroData==='pagamento'?'#6366f1':'transparent', color:filtroData==='pagamento'?'white':'#6b7280', whiteSpace:'nowrap' }}>
              Data pagamento
            </button>
          </div>
        </div>
      </div>
      {filtroData==='pagamento' && (
        <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'10px 14px', marginBottom:'18px', fontSize:'12px', color:'#4338ca', lineHeight:'1.5', wordBreak:'break-word' }}>
          Mostrando o que foi pago/recebido dentro do período. Contas a receber e a pagar continuam mostrando os vencimentos do período.
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px', width:'100%' }}>
        {[
          { label:'Receitas recebidas', v:totalReceitas, cor:'#059669', bg:'#ecfdf5', border:'#a7f3d0' },
          { label:'Despesas pagas',     v:totalDespesas, cor:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
          { label:'Lucro líquido',      v:lucro,          cor:lucro>=0?'#4f46e5':'#dc2626', bg:'#eef2ff', border:'#c7d2fe' },
          { label:'A receber',          v:totalAReceber,  cor:'#d97706', bg:'#fffbeb', border:'#fde68a' },
          { label:'A pagar',            v:totalAPagar,    cor:'#ea580c', bg:'#fff7ed', border:'#fed7aa', full:true },
        ].map(c=>(
          <div key={c.label} style={{ background:c.bg, borderRadius:'12px', border:`1px solid ${c.border}`, padding:'12px', gridColumn:(c as any).full?'1/-1':'auto', minWidth:0, overflow:'hidden' }}>
            <p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:'700', marginBottom:'4px' }}>{c.label}</p>
            <p style={{ fontSize:'18px', fontWeight:'800', color:c.cor, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{formatarMoeda(c.v)}</p>
          </div>
        ))}
      </div>

      {(receberAtrasados.length>0 || pagarAtrasados.length>0) && (
        <div style={{ display:'flex', gap:'10px', marginBottom:'20px', flexWrap:'wrap' }}>
          {receberAtrasados.length>0 && (
            <div style={{ flex:'1 1 220px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'12px', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ fontSize:'13px', color:'#9a3412' }}><b>{receberAtrasados.length}</b> conta(s) a receber em atraso - {formatarMoeda(receberAtrasados.reduce((s,l)=>s+l.valor,0))}</p>
            </div>
          )}
          {pagarAtrasados.length>0 && (
            <div style={{ flex:'1 1 220px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'12px', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ fontSize:'13px', color:'#991b1b' }}><b>{pagarAtrasados.length}</b> conta(s) a pagar em atraso - {formatarMoeda(pagarAtrasados.reduce((s,l)=>s+l.valor,0))}</p>
            </div>
          )}
        </div>
      )}

      <div style={{ display:'flex', marginBottom:'18px', borderBottom:'2px solid #f3f4f6', overflowX:'auto' }}>
        <button onClick={()=>setAba('visao_geral')} style={abaBtnStyle('visao_geral')}>Visão Geral</button>
        <button onClick={()=>setAba('receber')} style={abaBtnStyle('receber')}>Contas a Receber {contasReceber.length>0 && `(${contasReceber.length})`}</button>
        <button onClick={()=>setAba('pagar')} style={abaBtnStyle('pagar')}>Contas a Pagar {contasPagar.length>0 && `(${contasPagar.length})`}</button>
        <button onClick={()=>setAba('pagas')} style={abaBtnStyle('pagas')}>Contas Pagas</button>
        <button onClick={()=>setAba('relatorio')} style={abaBtnStyle('relatorio')}>Relatório</button>
      </div>

      {aba !== 'visao_geral' && aba !== 'relatorio' && (
        <div style={{ display:'flex', gap:'10px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por descrição ou cliente..." style={{ ...inputStyle, flex:'1 1 220px' }}/>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={()=>{
              const lista = aba==='receber' ? contasReceber : aba==='pagar' ? contasPagar : contasPagasLista
              exportarExcel(filtraBusca(lista), aba==='receber'?'contas-a-receber':aba==='pagar'?'contas-a-pagar':'contas-pagas')
            }} style={{ background:'#f0fdf4', color:'#059669', border:'1px solid #bbf7d0', borderRadius:'9px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
              Excel
            </button>
            <button onClick={()=>{
              const lista = aba==='receber' ? contasReceber : aba==='pagar' ? contasPagar : contasPagasLista
              const titulo = aba==='receber'?'Contas a Receber':aba==='pagar'?'Contas a Pagar':'Contas Pagas'
              exportarPDF(filtraBusca(lista), titulo)
            }} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'9px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
              PDF
            </button>
          </div>
        </div>
      )}

      {aba==='visao_geral' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'16px' }}>
            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f0f0f8', padding:'18px', boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
              <h3 style={{ fontSize:'14px', fontWeight:'700', color:'#1a1a2e', marginBottom:'2px' }}>Resumo do período</h3>
              <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'14px' }}>Por {filtroData==='vencimento'?'data de lançamento':'data de pagamento'}</p>
              {[
                { label:'Receitas (lançamentos pagos)', v:receitasLanc, cor:'#059669' },
                { label:'Receitas (atendimentos finalizados)', v:receitasAgs, cor:'#059669' },
                { label:'Total de receitas', v:totalReceitas, cor:'#059669', bold:true },
                { label:'Total de despesas pagas', v:totalDespesas, cor:'#dc2626', bold:true },
                { label:'Lucro líquido', v:lucro, cor:lucro>=0?'#4f46e5':'#dc2626', bold:true, divider:true },
              ].map((row,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderTop: row.divider ? '1.5px solid #f0f0f0' : 'none', marginTop: row.divider ? '4px' : '0' }}>
                  <span style={{ fontSize:'13px', fontWeight: row.bold?'700':'400', color: row.bold?'#1a1a2e':'#6b7280' }}>{row.label}</span>
                  <span style={{ fontSize: row.bold?'16px':'14px', fontWeight: row.bold?'800':'600', color:row.cor }}>{formatarMoeda(row.v)}</span>
                </div>
              ))}
            </div>

            <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f0f0f8', padding:'18px', boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
              <h3 style={{ fontSize:'14px', fontWeight:'700', color:'#1a1a2e', marginBottom:'16px' }}>Pendências</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <div onClick={()=>setAba('receber')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderRadius:'10px', background:'#fffbeb', border:'1px solid #fde68a', cursor:'pointer' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#92400e' }}>Contas a receber</p>
                    <p style={{ fontSize:'11px', color:'#b45309' }}>{contasReceber.length} pendente(s){receberAtrasados.length>0 ? `, ${receberAtrasados.length} atrasada(s)` : ''}</p>
                  </div>
                  <p style={{ fontSize:'16px', fontWeight:'800', color:'#d97706' }}>{formatarMoeda(totalAReceber)}</p>
                </div>
                <div onClick={()=>setAba('pagar')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderRadius:'10px', background:'#fff7ed', border:'1px solid #fed7aa', cursor:'pointer' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#9a3412' }}>Contas a pagar</p>
                    <p style={{ fontSize:'11px', color:'#c2410c' }}>{contasPagar.length} pendente(s){pagarAtrasados.length>0 ? `, ${pagarAtrasados.length} atrasada(s)` : ''}</p>
                  </div>
                  <p style={{ fontSize:'16px', fontWeight:'800', color:'#ea580c' }}>{formatarMoeda(totalAPagar)}</p>
                </div>
                <div onClick={()=>setAba('pagas')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderRadius:'10px', background:'#f0fdf4', border:'1px solid #bbf7d0', cursor:'pointer' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#065f46' }}>Contas pagas/quitadas</p>
                    <p style={{ fontSize:'11px', color:'#059669' }}>{contasPagasLista.length} no período</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f0f0f8', padding:'18px', boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
              <h3 style={{ fontSize:'14px', fontWeight:'700', color:'#1a1a2e' }}>Atendimentos finalizados</h3>
              <span style={{ fontSize:'16px', fontWeight:'800', color:'#059669' }}>{formatarMoeda(receitasAgs)}</span>
            </div>
            <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'-10px', marginBottom:'14px' }}>Receita automática da agenda</p>
            {carregando ? <p style={{ fontSize:'13px', color:'#9ca3af' }}>Carregando...</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'260px', overflowY:'auto' }}>
                {agsFinalizados.slice(0,8).map(a=>(
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px', background:'#fafafa' }}>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e', overflowWrap:'break-word' }}>{a.cliente}</p>
                      <p style={{ fontSize:'11px', color:'#9ca3af', overflowWrap:'break-word' }}>{a.servico} · {fmtData(a.data_inicio.slice(0,10))}</p>
                    </div>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#059669', flexShrink:0, whiteSpace:'nowrap' }}>+{formatarMoeda(a.valor)}</p>
                  </div>
                ))}
                {agsFinalizados.length===0 && <p style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', padding:'20px' }}>Nenhum atendimento finalizado no período.</p>}
                {agsFinalizados.length>8 && <p style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', padding:'6px' }}>+ {agsFinalizados.length-8} outro(s)</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {aba==='receber' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {carregando ? <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div> : (
            <>
              {filtraBusca(contasReceber).map(l=>{
                const atrasado = l.data_vencimento < hoje
                return (
                  <div key={l.id} style={{ background:'white', borderRadius:'14px', border:`1px solid ${atrasado?'#fed7aa':'#f0f0f8'}`, padding:'14px 16px', display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ width:'38px', height:'38px', borderRadius:'11px', background:'#fffbeb', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', overflowWrap:'break-word' }}>{l.descricao}</p>
                        <p style={{ fontSize:'12px', color:'#9ca3af', overflowWrap:'break-word' }}>{l.categoria}{l.cliente_nome?' · '+l.cliente_nome:''}</p>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ fontSize:'16px', fontWeight:'800', color:'#d97706', whiteSpace:'nowrap' }}>{formatarMoeda(l.valor)}</p>
                        <p style={{ fontSize:'11px', color: atrasado ? '#ea580c' : '#9ca3af', fontWeight: atrasado ? '700' : '400', whiteSpace:'nowrap' }}>
                          {atrasado ? 'Atrasado · ' : 'Vence '}{fmtData(l.data_vencimento)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', paddingLeft:'50px' }}>
                      {podeAlterar && <button onClick={()=>abrirModalQuitar(l)} style={{ flex:'1 1 auto', background:'#059669', color:'white', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>Receber</button>}
                      {l.origem!=='agendamento' && podeAlterar && <button onClick={()=>abrirEdicao(l)} style={{ flex:'1 1 auto', background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>Editar</button>}
                      {l.origem!=='agendamento' && podeExcluir && <button onClick={()=>excluir(l.id)} style={{ flex:'1 1 auto', background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>Excluir</button>}
                    </div>
                  </div>
                )
              })}
              {filtraBusca(contasReceber).length===0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhuma conta a receber no período.</div>}
            </>
          )}
        </div>
      )}

      {aba==='pagar' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {carregando ? <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div> : (
            <>
              {filtraBusca(contasPagar).map(l=>{
                const atrasado = l.data_vencimento < hoje
                return (
                  <div key={l.id} style={{ background:'white', borderRadius:'14px', border:`1px solid ${atrasado?'#fecaca':'#f0f0f8'}`, padding:'14px 16px', display:'flex', flexDirection:'column', gap:'12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ width:'38px', height:'38px', borderRadius:'11px', background:'#fff7ed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', overflowWrap:'break-word' }}>{l.descricao}</p>
                        <p style={{ fontSize:'12px', color:'#9ca3af', overflowWrap:'break-word' }}>{l.categoria}</p>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ fontSize:'16px', fontWeight:'800', color:'#ea580c', whiteSpace:'nowrap' }}>{formatarMoeda(l.valor)}</p>
                        <p style={{ fontSize:'11px', color: atrasado ? '#dc2626' : '#9ca3af', fontWeight: atrasado ? '700' : '400', whiteSpace:'nowrap' }}>
                          {atrasado ? 'Atrasado · ' : 'Vence '}{fmtData(l.data_vencimento)}
                        </p>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', paddingLeft:'50px' }}>
                      {podeAlterar && <button onClick={()=>abrirModalQuitar(l)} style={{ flex:'1 1 auto', background:'#ea580c', color:'white', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>Pagar</button>}
                      {podeAlterar && <button onClick={()=>abrirEdicao(l)} style={{ flex:'1 1 auto', background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>Editar</button>}
                      {podeExcluir && <button onClick={()=>excluir(l.id)} style={{ flex:'1 1 auto', background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>Excluir</button>}
                    </div>
                  </div>
                )
              })}
              {filtraBusca(contasPagar).length===0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhuma conta a pagar no período.</div>}
            </>
          )}
        </div>
      )}

      {aba==='pagas' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {carregando ? <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div> : (
            <>
              {filtraBusca(contasPagasLista).map(l=>(
                <div key={l.id} style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'38px', height:'38px', borderRadius:'11px', background:l.tipo==='receita'?'#ecfdf5':'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={l.tipo==='receita'?'#059669':'#dc2626'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                        <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', overflowWrap:'break-word' }}>{l.descricao}</p>
                        <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'99px', background:'#d1fae5', color:'#065f46', whiteSpace:'nowrap' }}>Quitado</span>
                      </div>
                      <p style={{ fontSize:'12px', color:'#9ca3af', overflowWrap:'break-word' }}>
                        {l.categoria}{l.cliente_nome?' · '+l.cliente_nome:''}{l.forma_pagamento?' · '+l.forma_pagamento:''}{l.origem==='agendamento'?' · agenda':''}
                      </p>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:'16px', fontWeight:'800', color:l.tipo==='receita'?'#059669':'#dc2626', whiteSpace:'nowrap' }}>{l.tipo==='receita'?'+':'-'}{formatarMoeda(l.valor)}</p>
                      <p style={{ fontSize:'11px', color:'#9ca3af', whiteSpace:'nowrap' }}>Pago em {l.data_pagamento?fmtData(l.data_pagamento):'-'}</p>
                    </div>
                  </div>
                  {(l.origem!=='agendamento' && (podeAlterar || podeExcluir)) && (
                    <div style={{ display:'flex', gap:'6px', paddingLeft:'50px' }}>
                      {podeAlterar && <button onClick={()=>reabrirConta(l)} style={{ flex:'1 1 auto', background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>Reabrir</button>}
                      {podeExcluir && <button onClick={()=>excluir(l.id)} style={{ flex:'1 1 auto', background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'8px', padding:'8px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap' }}>Excluir</button>}
                    </div>
                  )}
                </div>
              ))}
              {filtraBusca(contasPagasLista).length===0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhuma conta paga no período.</div>}
            </>
          )}
        </div>
      )}

      {aba==='relatorio' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #f0f0f8', padding:'20px', boxShadow:'0 1px 2px rgba(15,23,42,0.03)' }}>
            <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e', marginBottom:'4px' }}>Resumo financeiro - {labelPeriodo}</h2>
            <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'18px' }}>Filtrado por {filtroData==='vencimento'?'data de lançamento':'data de pagamento'}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {[
                { label:'Receitas de lançamentos (pagos)',   v:receitasLanc,   cor:'#059669', bold:false },
                { label:'Receitas de atendimentos fechados', v:receitasAgs,    cor:'#059669', bold:false },
                { label:'Total de receitas',                 v:totalReceitas,  cor:'#059669', bold:true  },
                { label:'Total de despesas pagas',            v:totalDespesas, cor:'#dc2626', bold:false },
                { label:'Lucro líquido',                      v:lucro,         cor:lucro>=0?'#4f46e5':'#dc2626', bold:true },
                { label:'Contas a receber (pendente)',        v:totalAReceber, cor:'#d97706', bold:false },
                { label:'Contas a pagar (pendente)',           v:totalAPagar,  cor:'#ea580c', bold:false },
              ].map(row=>(
                <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:'10px', background:row.bold?'#f8f8fc':'transparent' }}>
                  <span style={{ fontSize:'14px', fontWeight:row.bold?'700':'400', color:'#374151' }}>{row.label}</span>
                  <span style={{ fontSize:row.bold?'17px':'15px', fontWeight:row.bold?'800':'500', color:row.cor }}>{formatarMoeda(row.v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
            <button onClick={()=>exportarExcel(lancamentosNoPeriodo, 'relatorio-financeiro')} style={{ background:'#f0fdf4', color:'#059669', border:'1px solid #bbf7d0', borderRadius:'9px', padding:'10px 18px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
              Exportar Excel
            </button>
            <button onClick={()=>exportarPDF(lancamentosNoPeriodo, 'Relatório Financeiro')} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'9px', padding:'10px 18px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
              Exportar PDF
            </button>
          </div>
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'480px', borderRadius:'18px', padding:'20px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e' }}>{modoEdicao?'Editar lançamento':'Novo lançamento'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px', color:'#6b7280' }}>×</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
              {(['receita','despesa'] as const).map(t=>(
                <div key={t} onClick={()=>setForm(p=>({...p,tipo:t,categoria:(t==='receita'?opcoesCategoriaReceita:opcoesCategoriaDespesa)[0]||''}))}
                  style={{ padding:'12px', borderRadius:'10px', textAlign:'center', cursor:'pointer', border:`2px solid ${form.tipo===t?(t==='receita'?'#10b981':'#ef4444'):'#e5e7eb'}`, background:form.tipo===t?(t==='receita'?'#ecfdf5':'#fef2f2'):'white' }}>
                  <p style={{ fontSize:'13px', fontWeight:'700', color:form.tipo===t?(t==='receita'?'#10b981':'#ef4444'):'#6b7280' }}>{t==='receita'?'Receita':'Despesa'}</p>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Descrição *</label>
                <input value={form.descricao} onChange={f('descricao')} style={inputStyle} placeholder="Ex: Consulta João Silva"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Valor (R$) *</label>
                  <input type="number" min="0" step="0.01" value={form.valor} onChange={f('valor')} style={inputStyle} placeholder="0,00"/>
                </div>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'6px' }}>
                    <label style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>Categoria</label>
                    <button type="button" onClick={()=>abrirModalCategorias(form.tipo)} style={{ background:'none', border:'none', color:'#6366f1', fontSize:'11.5px', fontWeight:'600', cursor:'pointer', padding:0 }}>Gerenciar</button>
                  </div>
                  <select value={form.categoria} onChange={f('categoria')} style={inputStyle}>
                    {(form.tipo==='receita'?opcoesCategoriaReceita:opcoesCategoriaDespesa).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Vencimento</label>
                  <input type="date" value={form.data_vencimento} onChange={f('data_vencimento')} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Data pagamento</label>
                  <input type="date" value={form.data_pagamento} onChange={e=>setForm(p=>({...p,data_pagamento:e.target.value,status:e.target.value?'pago':'pendente'}))} style={inputStyle}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                  <select value={form.status} onChange={f('status')} style={inputStyle}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Forma de pagamento</label>
                  <select value={form.forma_pagamento} onChange={f('forma_pagamento')} style={inputStyle}>
                    {FORMAS.map(fp=><option key={fp} value={fp}>{fp||'Selecionar...'}</option>)}
                  </select>
                </div>
              </div>
              {form.tipo==='receita' && (
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cliente (opcional)</label>
                  <select value={form.cliente_id} onChange={f('cliente_id')} style={inputStyle}>
                    <option value="">Sem cliente</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Observações</label>
                <textarea value={form.observacoes} onChange={f('observacoes')} rows={2} style={{ ...inputStyle, resize:'none' as const }} placeholder="Opcional"/>
              </div>
            </div>

            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao&&selecionado&&podeExcluir
                ? <button onClick={()=>excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'600', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':modoEdicao?'Salvar':'Lançar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalQuitar && quitarSel && (
        <div onClick={()=>{ setModalQuitar(false); setQuitarSel(null) }} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'18px', width:'100%', maxWidth:'400px', padding:'20px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize:'16px', fontWeight:'700', marginBottom:'4px' }}>
              {quitarSel.tipo==='receita' ? 'Confirmar recebimento' : 'Confirmar pagamento'}
            </h3>
            <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'18px' }}>{quitarSel.descricao}</p>

            <div style={{ background:'#f9fafb', borderRadius:'10px', padding:'12px 14px', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'13px', color:'#6b7280' }}>Valor</span>
              <span style={{ fontSize:'18px', fontWeight:'800', color:quitarSel.tipo==='receita'?'#059669':'#ea580c' }}>{formatarMoeda(quitarSel.valor)}</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Data {quitarSel.tipo==='receita'?'do recebimento':'do pagamento'}</label>
                <input type="date" value={formQuitar.data_pagamento} onChange={e=>setFormQuitar(p=>({...p,data_pagamento:e.target.value}))} style={inputStyle}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'5px' }}>Forma de pagamento</label>
                <select value={formQuitar.forma_pagamento} onChange={e=>setFormQuitar(p=>({...p,forma_pagamento:e.target.value}))} style={inputStyle}>
                  {FORMAS.filter(fp=>fp).map(fp=><option key={fp} value={fp}>{fp}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'20px' }}>
              <button onClick={()=>{ setModalQuitar(false); setQuitarSel(null) }} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
              <button onClick={confirmarQuitacao} disabled={salvandoQuitar}
                style={{ background: salvandoQuitar ? '#a5b4fc' : (quitarSel.tipo==='receita'?'#059669':'#ea580c'), color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'700', cursor:salvandoQuitar?'not-allowed':'pointer' }}>
                {salvandoQuitar?'Salvando...':'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCategorias && (
        <div onClick={()=>setModalCategorias(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:210, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'18px', width:'100%', maxWidth:'440px', padding:'20px', maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e' }}>Categorias</h2>
              <button onClick={()=>setModalCategorias(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px', color:'#6b7280' }}>×</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
              {(['receita','despesa'] as const).map(t=>(
                <button key={t} onClick={()=>setTipoCategoriaModal(t)}
                  style={{ padding:'10px', borderRadius:'10px', textAlign:'center', cursor:'pointer', border:`2px solid ${tipoCategoriaModal===t?(t==='receita'?'#10b981':'#ef4444'):'#e5e7eb'}`, background:tipoCategoriaModal===t?(t==='receita'?'#ecfdf5':'#fef2f2'):'white' }}>
                  <span style={{ fontSize:'13px', fontWeight:'700', color:tipoCategoriaModal===t?(t==='receita'?'#10b981':'#ef4444'):'#6b7280' }}>{t==='receita'?'Receita':'Despesa'}</span>
                </button>
              ))}
            </div>

            <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
              <input value={novaCategoria} onChange={e=>setNovaCategoria(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') criarCategoria() }} placeholder="Nova categoria..." style={{ ...inputStyle, flex:1 }}/>
              <button onClick={criarCategoria} disabled={salvandoCategoria || !novaCategoria.trim()} style={{ background:salvandoCategoria||!novaCategoria.trim()?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'10px', padding:'0 18px', fontSize:'14px', fontWeight:'600', cursor:salvandoCategoria||!novaCategoria.trim()?'not-allowed':'pointer', whiteSpace:'nowrap' }}>
                + Adicionar
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {categorias.filter(c=>c.tipo===tipoCategoriaModal).length === 0 && (
                <p style={{ fontSize:'12.5px', color:'#9ca3af', textAlign:'center', padding:'16px' }}>
                  Nenhuma categoria cadastrada ainda. Por enquanto está usando a lista padrão do sistema — cadastre acima para personalizar.
                </p>
              )}
              {categorias.filter(c=>c.tipo===tipoCategoriaModal).map(c=>(
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 12px', borderRadius:'10px', background: c.ativo ? '#fafafa' : '#f3f4f6', opacity: c.ativo ? 1 : 0.6 }}>
                  {editandoCategoriaId === c.id ? (
                    <input value={editandoCategoriaNome} onChange={e=>setEditandoCategoriaNome(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') salvarEdicaoCategoria(); if(e.key==='Escape') setEditandoCategoriaId('') }}
                      onBlur={salvarEdicaoCategoria} autoFocus
                      style={{ flex:1, border:'1.5px solid #6366f1', borderRadius:'7px', padding:'5px 8px', fontSize:'13px', outline:'none' }}/>
                  ) : (
                    <span onClick={()=>podeAlterar && iniciarEdicaoCategoria(c)} style={{ flex:1, fontSize:'13.5px', color:'#1a1a2e', cursor:podeAlterar?'pointer':'default', textDecoration: c.ativo ? 'none' : 'line-through' }}>{c.nome}</span>
                  )}
                  {podeAlterar && (
                    <button onClick={()=>alternarAtivoCategoria(c)} title={c.ativo?'Desativar':'Ativar'} style={{ background:'none', border:'none', cursor:'pointer', color:c.ativo?'#059669':'#9ca3af', fontSize:'11px', fontWeight:'600', padding:'4px 6px' }}>
                      {c.ativo?'Ativa':'Inativa'}
                    </button>
                  )}
                  {podeExcluir && (
                    <button onClick={()=>excluirCategoria(c)} title="Excluir" style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:'15px', padding:'4px 6px' }}>×</button>
                  )}
                </div>
              ))}
            </div>

            <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'14px' }}>Categorias inativas não aparecem para escolher em novos lançamentos, mas continuam visíveis nos lançamentos já existentes.</p>
          </div>
        </div>
      )}

      {modalDRE && (
        <div onClick={()=>setModalDRE(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', zIndex:210, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'18px', width:'100%', maxWidth:'440px', padding:'20px', maxHeight:'88vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e' }}>DRE — Demonstrativo de Resultado</h2>
              <button onClick={()=>setModalDRE(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px', color:'#6b7280', flexShrink:0 }}>×</button>
            </div>
            <p style={{ fontSize:'12.5px', color:'#9ca3af', marginBottom:'18px' }}>Escolha o período e o critério de data para gerar o relatório.</p>

            <div style={{ marginBottom:'16px' }}>
              <span style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>Período</span>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {[['hoje','Hoje'],['mes','Este mês'],['ano','Este ano'],['periodo','Personalizado']].map(([v,l])=>(
                  <button key={v} onClick={()=>setDreFiltroTipo(v as any)} style={{ padding:'7px 14px', borderRadius:'99px', fontSize:'13px', fontWeight:'600', cursor:'pointer', border:dreFiltroTipo===v?'1.5px solid #6366f1':'1px solid #e5e7eb', background:dreFiltroTipo===v?'#eef2ff':'white', color:dreFiltroTipo===v?'#6366f1':'#6b7280' }}>{l}</button>
                ))}
              </div>
              {dreFiltroTipo==='periodo' && (
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginTop:'10px' }}>
                  <input type="date" value={dreIni} onChange={e=>setDreIni(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none', maxWidth:'160px', boxSizing:'border-box' as const }}/>
                  <span style={{ fontSize:'13px', color:'#9ca3af' }}>até</span>
                  <input type="date" value={dreFim} onChange={e=>setDreFim(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none', maxWidth:'160px', boxSizing:'border-box' as const }}/>
                </div>
              )}
            </div>

            <div style={{ paddingTop:'14px', borderTop:'1.5px solid #f3f4f6', marginBottom:'8px' }}>
              <span style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>Considerar</span>
              <div style={{ display:'flex', gap:'4px', background:'#f4f5fb', borderRadius:'99px', padding:'4px', width:'fit-content', flexWrap:'wrap' }}>
                <button onClick={()=>setDreCriterio('vencimento')} style={{ padding:'7px 15px', borderRadius:'99px', fontSize:'12.5px', fontWeight:'600', cursor:'pointer', border:'none', background:dreCriterio==='vencimento'?'#6366f1':'transparent', color:dreCriterio==='vencimento'?'white':'#6b7280', whiteSpace:'nowrap' }}>
                  Data lançamento
                </button>
                <button onClick={()=>setDreCriterio('pagamento')} style={{ padding:'7px 15px', borderRadius:'99px', fontSize:'12.5px', fontWeight:'600', cursor:'pointer', border:'none', background:dreCriterio==='pagamento'?'#6366f1':'transparent', color:dreCriterio==='pagamento'?'white':'#6b7280', whiteSpace:'nowrap' }}>
                  Data pagamento
                </button>
              </div>
              <p style={{ fontSize:'11.5px', color:'#9ca3af', marginTop:'8px' }}>
                {dreCriterio==='pagamento'
                  ? 'Considera lançamentos efetivamente pagos/recebidos dentro do período.'
                  : 'Considera lançamentos pagos cujo vencimento caiu dentro do período.'}
              </p>
            </div>

            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'20px' }}>
              <button onClick={()=>setModalDRE(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
              <button onClick={gerarDRE} disabled={gerandoDRE}
                style={{ background: gerandoDRE ? '#a5b4fc' : '#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 22px', fontSize:'14px', fontWeight:'700', cursor:gerandoDRE?'not-allowed':'pointer' }}>
                {gerandoDRE?'Gerando...':'Gerar / Visualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
