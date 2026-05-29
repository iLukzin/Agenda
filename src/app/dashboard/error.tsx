'use client'

import { useEffect } from 'react'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('DASHBOARD ERROR:', error?.message, error?.stack)
  }, [error])

  return (
    <div style={{ padding:'32px', maxWidth:'700px', margin:'0 auto' }}>
      <div style={{ background:'white', borderRadius:'16px', border:'1px solid #fecaca', overflow:'hidden' }}>
        <div style={{ background:'#dc2626', padding:'16px 20px', display:'flex', alignItems:'center', gap:'10px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ color:'white', fontWeight:'700', fontSize:'15px' }}>Erro no Dashboard</p>
        </div>
        <div style={{ padding:'20px' }}>
          <div style={{ background:'#fef2f2', borderRadius:'8px', padding:'14px', marginBottom:'16px', fontFamily:'monospace', fontSize:'12px', color:'#991b1b', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:'300px', overflow:'auto' }}>
            {error?.message || 'Erro desconhecido'}
            {'\n\n'}
            {error?.stack?.slice(0, 1000) || ''}
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={reset} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
              Tentar novamente
            </button>
            <button onClick={() => window.location.href = '/dashboard'} style={{ background:'#f3f4f6', color:'#374151', border:'none', borderRadius:'8px', padding:'9px 18px', cursor:'pointer', fontSize:'13px' }}>
              Recarregar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
