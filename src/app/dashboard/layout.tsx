// BUILD: 1782429392
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa, EmpresaResumo } from '@/context/EmpresaContext'
import { permPadrao, buscarPermissoes, type Permissao } from '@/lib/permissoes'
import BannerTrial from './BannerTrial'

const navItems = [
  { href:'/dashboard',               icon:'DASH', label:'Dashboard'     },
  { href:'/dashboard/agenda',        icon:'CAL',  label:'Agenda'        },
  { href:'/dashboard/clientes',      icon:'USR',  label:'Clientes'      },
  { href:'/dashboard/profissionais', icon:'DOC',  label:'Profissionais' },
  { href:'/dashboard/servicos',      icon:'SRV',  label:'Servicos'      },
  { href:'/dashboard/financeiro',       icon:'FIN',  label:'Financeiro'       },
  { href:'/dashboard/rel-profissional', icon:'REL',  label:'Rel. Profissional' },
  { href:'/dashboard/mensagens',       icon:'WPP',  label:'Mensagens WPP' },
  { href:'/dashboard/usuarios',      icon:'PEO',  label:'Usuarios'      },
  { href:'/dashboard/configuracoes', icon:'CFG',  label:'Configuracoes' },
]

const navMaster = [
  { href:'/master/empresas',     icon:'BLD', label:'Empresas'       },
  { href:'/master/recebimentos', icon:'FIN', label:'Recebimentos'   },
  { href:'/master/usuarios',     icon:'CRW', label:'Usuarios Master' },
  { href:'/master/permissoes',   icon:'LCK', label:'Permissoes'      },
]

function NavIcon({ code, size = 18 }: { code: string; size?: number }) {
  const icons = {
    DASH: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
    ),
    CAL: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        <circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/>
      </svg>
    ),
    USR: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    DOC: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        <path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/>
        <circle cx="12" cy="14" r="2"/>
      </svg>
    ),
    SRV: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    FIN: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    PEO: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    CFG: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    BLD: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    CRW: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    LCK: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    MENU: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
    CLOSE: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
    CHK: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    OUT: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
    ARR: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    ),
  }
  const extra = {
    REL: (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
  }
  return icons[code] || extra[code] || null
}

function permPadraoLayout(nivel: string) {
  if (nivel === 'usuario') return {
    dashboard: { visualizar:false }, agenda: { visualizar:true }, agenda_wpp: { visualizar:false },
    clientes: { visualizar:false }, profissionais: { visualizar:false },
    servicos: { visualizar:false }, financeiro: { visualizar:false },
    mensagens: { visualizar:false }, usuarios: { visualizar:false }, configuracoes: { visualizar:false }, rel_profissional: { visualizar:false },
  }
  if (nivel === 'profissional') return {
    dashboard: { visualizar:true }, agenda: { visualizar:true }, agenda_wpp: { visualizar:false },
    clientes: { visualizar:true }, profissionais: { visualizar:true },
    servicos: { visualizar:true }, financeiro: { visualizar:false },
    mensagens: { visualizar:false }, usuarios: { visualizar:false }, configuracoes: { visualizar:false }, rel_profissional: { visualizar:false },
  }
  return { dashboard:{visualizar:true}, agenda:{visualizar:true}, agenda_wpp:{visualizar:true}, clientes:{visualizar:true}, profissionais:{visualizar:true}, servicos:{visualizar:true}, financeiro:{visualizar:true}, mensagens:{visualizar:true}, usuarios:{visualizar:true}, configuracoes:{visualizar:true}, rel_profissional:{visualizar:true} }
}


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { usuario, empresaAtiva, empresas, trocarEmpresa, isMaster, carregando } = useEmpresa()
  const [sidebarAberta, setSidebarAberta] = useState(true)
  const [menuMobile, setMenuMobile]       = useState(false)
  const [isMobile, setIsMobile]           = useState(false)
  const [dropEmpresa, setDropEmpresa]     = useState(false)
  const [permMap, setPermMap] = useState({} as Record<string, Permissao>)


  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [saindo, setSaindo] = useState(false)


  useEffect(() => {
    if (!usuario?.id || isMaster) return
    buscarPermissoes(usuario.id).then(mapa => {
      if (Object.keys(mapa).length > 0) {
        setPermMap(mapa)
      } else {
        setPermMap(permPadrao(usuario.nivel_acesso || 'profissional'))
      }
    })
  }, [usuario?.id, isMaster, usuario?.nivel_acesso])

  useEffect(() => {
    if (!carregando) return
    const t = setTimeout(() => setLoadingTimeout(true), 8000)
    return () => clearTimeout(t)
  }, [carregando])

  // Protege as rotas do dashboard: se não estiver autenticado, redireciona para login
  useEffect(() => {
    if (carregando) return
    if (!usuario) {
      if (typeof window !== 'undefined') window.location.href = '/auth/login'
    }
  }, [carregando, usuario])

  useEffect(() => {
    function checar() {
      const mob = window.innerWidth < 768
      setIsMobile(mob)
      if (mob) setSidebarAberta(false)
      else setSidebarAberta(true)
    }
    checar()
    window.addEventListener('resize', checar)
    return () => window.removeEventListener('resize', checar)
  }, [])

  useEffect(() => { setMenuMobile(false) }, [pathname])

  async function handleLogout() {
    setSaindo(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') window.location.href = '/auth/login'
  }

  const sidebarW = sidebarAberta ? '240px' : '68px'

  if (saindo) return null

  if (carregando && !loadingTimeout) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f8f8fc' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:'40px', height:'40px', border:'3px solid #eef2ff', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color:'#9ca3af', fontSize:'14px' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  // Não autenticado: não renderiza o conteúdo do dashboard (redirecionamento em andamento)
  if (!usuario) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f8f8fc' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:'40px', height:'40px', border:'3px solid #eef2ff', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color:'#9ca3af', fontSize:'14px' }}>Redirecionando...</p>
        </div>
      </div>
    )
  }

  const sidebarProps = { sidebarAberta, setSidebarAberta, pathname, handleLogout, isMobile:false, usuario, empresaAtiva, empresas, trocarEmpresa, isMaster, dropEmpresa, setDropEmpresa, permMap }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f8f8fc' }}>
      {isMobile && menuMobile && (
        <div onClick={() => setMenuMobile(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:40 }}/>
      )}

      {!isMobile && (
        <aside style={{ width:sidebarW, background:'#0d1117', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:50, transition:'width .2s ease', overflow:'hidden' }}>
          <SidebarConteudo {...sidebarProps} isMobile={false}/>
        </aside>
      )}

      {isMobile && (
        <aside style={{ width:'260px', background:'#0d1117', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:50, transform:menuMobile?'translateX(0)':'translateX(-100%)', transition:'transform .25s ease' }}>
          <SidebarConteudo {...sidebarProps} sidebarAberta={true} isMobile={true} onClose={()=>setMenuMobile(false)}/>
        </aside>
      )}

      <main style={{ flex:1, marginLeft:isMobile?'0':sidebarW, transition:'margin-left .2s ease', height:'100vh', overflowY:'auto', display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Header mobile — position:fixed para nunca mover no scroll do navegador */}
        {isMobile && (
          <>
            <div id="mobile-header-fixed" style={{ position:'fixed', top:0, left:0, right:0, zIndex:30, background:'white', boxShadow:'0 1px 6px rgba(0,0,0,0.08)' }}>
              {/* Barra de navegação */}
              <div style={{ borderBottom:'1px solid #f0f0f8', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', background:'white' }}>
                <button onClick={() => setMenuMobile(true)} style={{ background:'none', border:'none', cursor:'pointer', color:'#374151' }}>
                  <NavIcon code="MENU" size={22}/>
                </button>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <Image src="/logo-fortitude.png" alt="Logo" width={28} height={28} style={{ borderRadius:'6px', objectFit:'contain' }}/>
                  <span style={{ fontWeight:'700', fontSize:'15px', color:'#1a1a2e' }}>AgendaFortitude</span>
                </div>
                {empresaAtiva && <span style={{ marginLeft:'auto', fontSize:'12px', color:'#9ca3af', background:'#f3f4f6', padding:'4px 10px', borderRadius:'99px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'110px' }}>{empresaAtiva.nome}</span>}
              </div>
              {/* Banner trial dentro do header fixo */}
              {empresaAtiva?.is_trial && empresaAtiva?.data_expiracao_trial && !isMaster && (
                <BannerTrial dataExpiracao={empresaAtiva.data_expiracao_trial} />
              )}
            </div>
            {/* Espaçador dinâmico — usa script para medir altura real do header */}
            <MobileHeaderSpacer hasTrial={!!(empresaAtiva?.is_trial && empresaAtiva?.data_expiracao_trial && !isMaster)} />
          </>
        )}
        {/* Banner trial no desktop — sticky no topo do main */}
        {!isMobile && empresaAtiva?.is_trial && empresaAtiva?.data_expiracao_trial && !isMaster && (
          <div style={{ position:'sticky', top:0, zIndex:29 }}>
            <BannerTrial dataExpiracao={empresaAtiva.data_expiracao_trial} />
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

// Componente client-side que mede a altura real do header fixo e aplica o espaçamento correto
function MobileHeaderSpacer({ hasTrial }: { hasTrial: boolean }) {
  const [height, setHeight] = useState(hasTrial ? 160 : 56)

  useEffect(() => {
    function medir() {
      const el = document.getElementById('mobile-header-fixed')
      if (el) setHeight(el.offsetHeight)
    }
    medir()
    const t = setTimeout(medir, 100)
    window.addEventListener('resize', medir)
    return () => { clearTimeout(t); window.removeEventListener('resize', medir) }
  }, [hasTrial])

  return <div style={{ height:`${height}px`, flexShrink:0 }}/>
}

function SidebarConteudo({ sidebarAberta, setSidebarAberta, pathname, handleLogout, isMobile, onClose, usuario, empresaAtiva, empresas, trocarEmpresa, isMaster, dropEmpresa, setDropEmpresa, permMap }: any) {
  return (
    <>
      {/* Logo */}
      <div style={{ padding:'16px 14px 12px', display:'flex', alignItems:'center', gap:'10px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ width:'36px', height:'36px', borderRadius:'10px', overflow:'hidden', flexShrink:0, background:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Image src="/logo-fortitude.png" alt="Logo Fortitude" width={32} height={32} style={{ objectFit:'contain' }}/>
        </div>
        {sidebarAberta && (
          <div style={{ flex:1, overflow:'hidden' }}>
            <p style={{ color:'white', fontWeight:'700', fontSize:'14px', whiteSpace:'nowrap', letterSpacing:'-0.2px' }}>AgendaFortitude</p>
            <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'10px', whiteSpace:'nowrap' }}>by Fortitude Sistym</p>
          </div>
        )}
        {!isMobile && (
          <button onClick={() => setSidebarAberta(!sidebarAberta)} style={{ marginLeft:'auto', background:'rgba(255,255,255,0.06)', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', flexShrink:0, width:'26px', height:'26px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <NavIcon code={sidebarAberta?'CLOSE':'MENU'} size={13}/>
          </button>
        )}
        {isMobile && onClose && (
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer' }}>
            <NavIcon code="CLOSE" size={18}/>
          </button>
        )}
      </div>

      {/* Seletor de empresa */}
      {sidebarAberta && empresaAtiva && (
        <div style={{ margin:'10px 10px 6px', position:'relative' }}>
          <button onClick={() => setDropEmpresa(!dropEmpresa)} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'9px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'7px', background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', color:'white', fontWeight:'700', flexShrink:0 }}>
              {empresaAtiva.nome.charAt(0)}
            </div>
            <div style={{ flex:1, textAlign:'left', overflow:'hidden' }}>
              <p style={{ fontSize:'12px', fontWeight:'600', color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{empresaAtiva.nome}</p>
              <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', textTransform:'capitalize' }}>{empresaAtiva.plano}</p>
            </div>
            {empresas.length > 1 && (
              <span style={{ color:'rgba(255,255,255,0.3)', flexShrink:0 }}>
                <NavIcon code="ARR" size={14}/>
              </span>
            )}
          </button>

          {dropEmpresa && empresas.length > 1 && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', zIndex:60, overflow:'hidden', maxHeight:'200px', overflowY:'auto' }}>
              {empresas.map((emp: EmpresaResumo) => (
                <button key={emp.id} onClick={() => { trocarEmpresa(emp); setDropEmpresa(false) }} style={{ width:'100%', padding:'10px 12px', background:emp.id===empresaAtiva?.id?'rgba(59,130,246,0.15)':'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ width:'24px', height:'24px', borderRadius:'6px', background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'white', fontWeight:'700', flexShrink:0 }}>
                    {emp.nome.charAt(0)}
                  </div>
                  <div style={{ textAlign:'left', flex:1 }}>
                    <p style={{ fontSize:'12px', color:'white', fontWeight:'500' }}>{emp.nome}</p>
                    <p style={{ fontSize:'10px', color:emp.status==='ativo'?'#10b981':'#ef4444' }}>{emp.status}</p>
                  </div>
                  {emp.id===empresaAtiva?.id && <span style={{ color:'#3b82f6' }}><NavIcon code="CHK" size={14}/></span>}
                </button>
              ))}
              <Link href="/master/empresas" style={{ display:'block', padding:'10px 12px', fontSize:'12px', color:'rgba(255,255,255,0.4)', textDecoration:'none', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                + Nova empresa
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex:1, padding:'8px 8px', display:'flex', flexDirection:'column', gap:'2px', overflowY:'auto' }}>
        {navItems.filter(item => {
          if (item.href === '/dashboard/mensagens' && !empresaAtiva?.whatsapp_habilitado) return false
          if (item.href === '/dashboard/financeiro' && !empresaAtiva?.financeiro_habilitado && !isMaster) return false
          return true
        }).map(item => {
          const ativo = pathname === item.href
          const telaKey = (item.href === '/dashboard' ? 'dashboard' : item.href.replace('/dashboard/','')).replace(/-/g,'_')
          const nivelAtual = usuario?.nivel_acesso || 'profissional'
          const temPermMapDados = Object.keys(permMap).length > 0
          const padrao = !temPermMapDados ? (isMaster ? null : permPadraoLayout(nivelAtual)) : null
          // Se permMap tem dados: usar permMap; se tela não está no mapa, usar padrão do nível
          const permItem = temPermMapDados
            ? (permMap[telaKey] || permPadraoLayout(nivelAtual)?.[telaKey] || null)
            : (padrao ? padrao[telaKey] : null)
          const temAcesso = isMaster || (permItem ? permItem.visualizar !== false : false)
          if (!temAcesso) return null
          return (
            <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 10px', borderRadius:'9px', textDecoration:'none', fontSize:'13px', fontWeight:ativo?'600':'400', color:ativo?'white':'rgba(255,255,255,0.5)', background:ativo?'rgba(99,102,241,0.15)':'transparent', transition:'all .15s', whiteSpace:'nowrap', position:'relative' }}>
              {ativo && <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:'3px', height:'20px', background:'#3b82f6', borderRadius:'0 3px 3px 0' }}/>}
              <span style={{ width:'20px', textAlign:'center', flexShrink:0, color:ativo?'#a5b4fc':'rgba(255,255,255,0.38)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <NavIcon code={item.icon} size={16}/>
              </span>
              {sidebarAberta && <span>{item.label}</span>}
            </Link>
          )
        })}

        {isMaster && sidebarAberta && (
          <>
            <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'8px 4px' }}/>
            <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.2)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 10px' }}>Master</p>
            {navMaster.filter(item => {
              if (item.href === '/master/recebimentos' && usuario?.email !== 'lucas@fortitude.com') return false
              return true
            }).map(item => {
              const ativo = pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 10px', borderRadius:'9px', textDecoration:'none', fontSize:'13px', fontWeight:ativo?'600':'400', color:ativo?'white':'rgba(255,255,255,0.5)', background:ativo?'rgba(99,102,241,0.15)':'transparent', transition:'all .15s', whiteSpace:'nowrap' }}>
                  <span style={{ width:'20px', textAlign:'center', flexShrink:0, color:ativo?'#a5b4fc':'rgba(255,255,255,0.38)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <NavIcon code={item.icon} size={16}/>
                  </span>
                  {sidebarAberta && <span>{item.label}</span>}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Usuario */}
      {sidebarAberta && usuario && (
        <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'white', flexShrink:0 }}>
            {usuario.nome.charAt(0)}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <p style={{ fontSize:'12px', color:'white', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{usuario.nome}</p>
            <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{usuario.email}</p>
          </div>

        </div>
      )}

      {/* Suporte */}
      <a href="https://wa.me/5534988018483" target="_blank" rel="noopener noreferrer"
        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 10px', margin:'4px 8px', borderRadius:'10px', textDecoration:'none', background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.15)', cursor:'pointer' }}
        title="Suporte">
        <div style={{ width:'32px', height:'32px', borderRadius:'9px', background:'linear-gradient(135deg,#25d366,#128c7e)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.25 1.18 2 2 0 012.25 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.18a16 16 0 006.91 6.91l.56-.56a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        </div>
        {sidebarAberta && (
          <div style={{ flex:1, overflow:'hidden' }}>
            <p style={{ fontSize:'12px', fontWeight:'700', color:'#25d366', margin:0 }}>Suporte</p>
            <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', margin:0 }}>Fale conosco</p>
          </div>
        )}
      </a>

      <div style={{ padding:'10px 8px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={handleLogout} style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', height:'36px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <NavIcon code="OUT" size={15}/>
          </button>
        </div>
    </>
  )
}
