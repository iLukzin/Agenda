'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa, EmpresaResumo } from '@/context/EmpresaContext'

const navItems = [
  { href:'/dashboard',                    icon:'⊞', label:'Dashboard'     },
  { href:'/dashboard/agenda',             icon:'📅', label:'Agenda'        },
  { href:'/dashboard/clientes',           icon:'👥', label:'Clientes'      },
  { href:'/dashboard/profissionais',      icon:'🩺', label:'Profissionais' },
  { href:'/dashboard/servicos',           icon:'✦',  label:'Serviços'      },
  { href:'/dashboard/financeiro',         icon:'💰', label:'Financeiro'    },
  { href:'/dashboard/usuarios',           icon:'👤', label:'Usuários'      },
  { href:'/dashboard/configuracoes',      icon:'⚙',  label:'Configurações' },
]

const navMaster = [
  { href:'/master/empresas', icon:'🏢', label:'Empresas'  },
  { href:'/master/usuarios', icon:'👑', label:'Usuários Master' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { usuario, empresaAtiva, empresas, trocarEmpresa, isMaster, carregando } = useEmpresa()
  const [sidebarAberta, setSidebarAberta] = useState(true)
  const [menuMobile, setMenuMobile] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [dropEmpresa, setDropEmpresa] = useState(false)

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
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const sidebarW = sidebarAberta ? '240px' : '68px'

  if (carregando) {
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

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f8f8fc' }}>
      {isMobile && menuMobile && (
        <div onClick={() => setMenuMobile(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:40 }}/>
      )}

      {/* Sidebar desktop */}
      {!isMobile && (
        <aside style={{ width:sidebarW, background:'#0f0f17', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:50, transition:'width .2s ease', overflow:'hidden' }}>
          <SidebarConteudo {...{ sidebarAberta, setSidebarAberta, pathname, handleLogout, isMobile:false, usuario, empresaAtiva, empresas, trocarEmpresa, isMaster, dropEmpresa, setDropEmpresa }} />
        </aside>
      )}

      {/* Drawer mobile */}
      {isMobile && (
        <aside style={{ width:'260px', background:'#0f0f17', display:'flex', flexDirection:'column', position:'fixed', top:0, left:0, bottom:0, zIndex:50, transform: menuMobile?'translateX(0)':'translateX(-100%)', transition:'transform .25s ease' }}>
          <SidebarConteudo {...{ sidebarAberta:true, setSidebarAberta, pathname, handleLogout, isMobile:true, onClose:()=>setMenuMobile(false), usuario, empresaAtiva, empresas, trocarEmpresa, isMaster, dropEmpresa, setDropEmpresa }} />
        </aside>
      )}

      <main style={{ flex:1, marginLeft:isMobile?'0':sidebarW, transition:'margin-left .2s ease', minHeight:'100vh', display:'flex', flexDirection:'column', minWidth:0 }}>
        {isMobile && (
          <div style={{ position:'sticky', top:0, zIndex:30, background:'white', borderBottom:'1px solid #f0f0f8', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={() => setMenuMobile(true)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'22px', color:'#374151' }}>☰</button>
            <span style={{ fontWeight:'600', fontSize:'16px', color:'#1a1a2e' }}>AgendaPro</span>
            {empresaAtiva && <span style={{ marginLeft:'auto', fontSize:'12px', color:'#9ca3af', background:'#f3f4f6', padding:'4px 10px', borderRadius:'99px' }}>{empresaAtiva.nome}</span>}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

function SidebarConteudo({ sidebarAberta, setSidebarAberta, pathname, handleLogout, isMobile, onClose, usuario, empresaAtiva, empresas, trocarEmpresa, isMaster, dropEmpresa, setDropEmpresa }: any) {
  return (
    <>
      {/* Logo + toggle */}
      <div style={{ padding:'16px 14px 10px', display:'flex', alignItems:'center', gap:'10px' }}>
        <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:'16px' }}>📅</span>
        </div>
        {sidebarAberta && <span style={{ color:'white', fontWeight:'600', fontSize:'15px', whiteSpace:'nowrap' }}>AgendaPro</span>}
        {!isMobile && (
          <button onClick={() => setSidebarAberta(!sidebarAberta)} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', flexShrink:0, fontSize:'12px' }}>
            {sidebarAberta ? '◀' : '▶'}
          </button>
        )}
        {isMobile && onClose && (
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:'20px' }}>✕</button>
        )}
      </div>

      {/* Seletor de empresa */}
      {sidebarAberta && empresaAtiva && (
        <div style={{ margin:'0 10px 8px', position:'relative' }}>
          <button onClick={() => setDropEmpresa(!dropEmpresa)} style={{
            width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:'8px', padding:'8px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px',
          }}>
            <div style={{ width:'24px', height:'24px', borderRadius:'6px', background:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'white', fontWeight:'600', flexShrink:0 }}>
              {empresaAtiva.nome.charAt(0)}
            </div>
            <div style={{ flex:1, textAlign:'left', overflow:'hidden' }}>
              <p style={{ fontSize:'12px', fontWeight:'600', color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{empresaAtiva.nome}</p>
              <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.4)' }}>{empresaAtiva.plano}</p>
            </div>
            {isMaster && empresas.length > 1 && <span style={{ color:'rgba(255,255,255,0.4)', fontSize:'10px' }}>▼</span>}
          </button>

          {/* Dropdown empresas (só master) */}
          {dropEmpresa && isMaster && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', marginTop:'4px', zIndex:60, overflow:'hidden', maxHeight:'200px', overflowY:'auto' }}>
              {empresas.map((emp: EmpresaResumo) => (
                <button key={emp.id} onClick={() => { trocarEmpresa(emp); setDropEmpresa(false) }} style={{
                  width:'100%', padding:'10px 12px', background: emp.id===empresaAtiva?.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ width:'22px', height:'22px', borderRadius:'6px', background:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'white', fontWeight:'700', flexShrink:0 }}>
                    {emp.nome.charAt(0)}
                  </div>
                  <div style={{ textAlign:'left' }}>
                    <p style={{ fontSize:'12px', color:'white', fontWeight:'500' }}>{emp.nome}</p>
                    <p style={{ fontSize:'10px', color: emp.status==='ativo'?'#10b981':'#ef4444' }}>{emp.status}</p>
                  </div>
                  {emp.id===empresaAtiva?.id && <span style={{ marginLeft:'auto', color:'#6366f1', fontSize:'14px' }}>✓</span>}
                </button>
              ))}
              <Link href="/master/empresas" style={{ display:'block', padding:'10px 12px', fontSize:'12px', color:'rgba(255,255,255,0.5)', textDecoration:'none', textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                + Nova empresa
              </Link>
            </div>
          )}
        </div>
      )}

      <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'0 12px 6px' }}/>

      {/* Nav principal */}
      <nav style={{ flex:1, padding:'4px 8px', display:'flex', flexDirection:'column', gap:'1px', overflowY:'auto' }}>
        {navItems.map(item => {
          const ativo = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{
              display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px',
              textDecoration:'none', fontSize:'13px', fontWeight: ativo?'500':'400',
              color: ativo?'white':'rgba(255,255,255,0.55)',
              background: ativo?'rgba(99,102,241,0.2)':'transparent',
              transition:'all .15s', whiteSpace:'nowrap', position:'relative',
            }}>
              {ativo && <div style={{ position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:'3px', height:'18px', background:'#6366f1', borderRadius:'0 3px 3px 0' }}/>}
              <span style={{ fontSize:'15px', width:'20px', textAlign:'center', flexShrink:0 }}>{item.icon}</span>
              {sidebarAberta && <span>{item.label}</span>}
            </Link>
          )
        })}

        {/* Seção Master */}
        {isMaster && sidebarAberta && (
          <>
            <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'8px 4px', }}/>
            <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.25)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'4px 10px' }}>Master</p>
            {navMaster.map(item => {
              const ativo = pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} style={{
                  display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px',
                  textDecoration:'none', fontSize:'13px', fontWeight: ativo?'500':'400',
                  color: ativo?'white':'rgba(255,255,255,0.55)',
                  background: ativo?'rgba(99,102,241,0.2)':'transparent',
                  transition:'all .15s', whiteSpace:'nowrap',
                }}>
                  <span style={{ fontSize:'15px', width:'20px', textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                  {sidebarAberta && <span>{item.label}</span>}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Usuário logado */}
      {sidebarAberta && usuario && (
        <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'rgba(99,102,241,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'600', color:'#a5b4fc', flexShrink:0 }}>
            {usuario.nome.charAt(0)}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <p style={{ fontSize:'12px', color:'white', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{usuario.nome}</p>
            <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{usuario.email}</p>
          </div>
          <button onClick={handleLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:'16px', padding:'2px' }} title="Sair">🚪</button>
        </div>
      )}

      {!sidebarAberta && (
        <div style={{ padding:'10px 8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleLogout} style={{ width:'100%', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.4)', fontSize:'16px', padding:'8px' }}>🚪</button>
        </div>
      )}
    </>
  )
}
