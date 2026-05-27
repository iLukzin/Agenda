'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'

type Status = {
  id: string
  nome: string
  cor: string
  icone: string
  ordem: number
  padrao: boolean
}

const CORES_STATUS = [
  '#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#6b7280'
]
const ICONES = ['📅','✅','🔄','⏳','❌','👤','💬','🏃','⭐']
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

const STATUS_PADRAO = [
  { nome:'Agendado',       cor:'#3b82f6', icone:'📅', ordem:1, padrao:true },
  { nome:'Confirmado',     cor:'#10b981', icone:'✅', ordem:2, padrao:true },
  { nome:'Em atendimento', cor:'#f59e0b', icone:'🔄', ordem:3, padrao:true },
  { nome:'Finalizado',     cor:'#6b7280', icone:'⭐', ordem:4, padrao:true },
  { nome:'Cancelado',      cor:'#ef4444', icone:'❌', ordem:5, padrao:true },
  { nome:'Não compareceu', cor:'#8b5cf6', icone:'👤', ordem:6, padrao:true },
]

export default function StatusPage() {
  const { empresaAtiva } = useEmpresa()
  const [statusList, setStatusList] = useState<Status[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Status|null>(null)
  const [form, setForm] = useState({ nome:'', cor:CORES_STATUS[0], icone:ICONES[0], ordem:'1' })

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const { data, error } = await sb
      .from('status_agendamento')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('ordem')
    if (error) {
      // Tabela pode não existir ainda — mostra lista padrão
      console.error(error)
      setStatusList([])
    } else {
      setStatusList(data || [])
    }
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  async function criarStatusPadrao() {
    if (!empresaAtiva?.id) return
    setSalvando(true)
    const sb = createClient()
    const { error } = await sb.from('status_agendamento').insert(
      STATUS_PADRAO.map(s => ({ ...s, empresa_id: empresaAtiva.id }))
    )
    if (error) { setErro('Erro: ' + error.message) }
    else { await carregar() }
    setSalvando(false)
  }

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    const proxOrdem = statusList.length + 1
    setForm({ nome:'', cor:CORES_STATUS[0], icone:ICONES[0], ordem:String(proxOrdem) })
    setModalAberto(true)
  }

  function abrirEdicao(s: Status) {
    setModoEdicao(true); setSelecionado(s); setErro('')
    setForm({ nome:s.nome, cor:s.cor, icone:s.icone, ordem:String(s.ordem) })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Nome é obrigatório.')
    if (!empresaAtiva?.id) return
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = { nome:form.nome.trim(), cor:form.cor, icone:form.icone, ordem:parseInt(form.ordem)||1 }
    let error: any
    if (modoEdicao && selecionado) {
      const res = await sb.from('status_agendamento').update(payload).eq('id', selecionado.id)
      error = res.error
    } else {
      const res = await sb.from('status_agendamento').insert({ ...payload, empresa_id:empresaAtiva.id, padrao:false })
      error = res.error
    }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id: string) {
    const s = statusList.find(s=>s.id===id)
    if (s?.padrao) return setErro('Status padrão não pode ser excluído.')
    if (!confirm('Excluir este status?')) return
    const sb = createClient()
    await sb.from('status_agendamento').delete().eq('id', id)
    await carregar(); fecharModal()
  }

  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Status de Agendamento</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{statusList.length} status cadastrados</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {statusList.length === 0 && (
            <button onClick={criarStatusPadrao} disabled={salvando} style={{ background:'#f3f4f6', color:'#374151', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>
              ✨ Criar status padrão
            </button>
          )}
          <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
            + Novo status
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'13px', color:'#4338ca' }}>
        💡 Os status criados aqui aparecerão ao criar e editar agendamentos. Clique em <b>Criar status padrão</b> para começar com os status mais usados.
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : statusList.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>
          <p style={{ fontSize:'36px', marginBottom:'12px' }}>📋</p>
          <p style={{ fontSize:'15px', fontWeight:'500', marginBottom:'8px' }}>Nenhum status cadastrado</p>
          <p style={{ fontSize:'13px' }}>Clique em <b>Criar status padrão</b> para começar.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {statusList.map(s => (
            <div key={s.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px' }}>
              {/* Cor + ícone */}
              <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:s.cor+'20', border:`2px solid ${s.cor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>
                {s.icone}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{s.nome}</p>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:s.cor }}/>
                  <span style={{ fontSize:'12px', color:'#9ca3af' }}>{s.cor}</span>
                  {s.padrao && <span style={{ fontSize:'11px', background:'#f3f4f6', color:'#6b7280', padding:'1px 8px', borderRadius:'99px' }}>padrão</span>}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'11px', color:'#9ca3af' }}>ordem {s.ordem}</span>
                <button onClick={() => abrirEdicao(s)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>✏️ Editar</button>
                {!s.padrao && <button onClick={() => excluir(s.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>🗑</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'460px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'✏️ Editar status':'+ Novo status'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome do status *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} style={inputStyle} placeholder="Ex: Aguardando confirmação"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Cor</label>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {CORES_STATUS.map(cor => (
                    <button key={cor} onClick={()=>setForm(f=>({...f,cor}))} style={{ width:'32px', height:'32px', borderRadius:'50%', background:cor, border:form.cor===cor?'3px solid #1a1a2e':'2px solid transparent', cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Ícone</label>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {ICONES.map(ic => (
                    <button key={ic} onClick={()=>setForm(f=>({...f,icone:ic}))} style={{ width:'36px', height:'36px', borderRadius:'8px', border:form.icone===ic?'2px solid #6366f1':'1px solid #e5e7eb', background:form.icone===ic?'#eef2ff':'white', fontSize:'18px', cursor:'pointer' }}>{ic}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Ordem de exibição</label>
                <input type="number" value={form.ordem} onChange={e=>setForm(f=>({...f,ordem:e.target.value}))} style={inputStyle} placeholder="1"/>
              </div>
              {/* Preview */}
              <div style={{ background:'#f9fafb', borderRadius:'10px', padding:'12px', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'13px', color:'#9ca3af' }}>Preview:</span>
                <span style={{ fontSize:'12px', fontWeight:'600', padding:'4px 12px', borderRadius:'99px', background:form.cor+'20', color:form.cor, display:'flex', alignItems:'center', gap:'6px' }}>
                  {form.icone} {form.nome||'Nome do status'}
                </span>
              </div>
            </div>
            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao&&selecionado&&!selecionado.padrao
                ? <button onClick={()=>excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':modoEdicao?'Salvar':'Criar status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
