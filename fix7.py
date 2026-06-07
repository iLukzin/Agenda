content = open('/home/claude/agendapro/src/context/EmpresaContext.tsx').read()

old_busca = """          // Buscar cada empresa com .eq() + maybeSingle()
          const todasEmpresas: any[] = []
          for (const empId of todasIds) {
            const { data: emp } = await sb
              .from('empresas')
              .select(SELECT_EMP)
              .eq('id', empId)
              .maybeSingle()
            if (emp) todasEmpresas.push(emp)
          }"""

new_busca = """          // Verificar sessão antes das queries
          const { data: { session } } = await sb.auth.getSession()
          if (!session) {
            console.error('[EmpresaCtx] Sem sessao ao buscar empresas')
            setEmpresas([])
            setEmpresaAtiva(null)
            return
          }
          console.log('[EmpresaCtx] Session OK, access_token:', session.access_token ? 'presente' : 'ausente')

          // Buscar cada empresa com .eq() + maybeSingle()
          const todasEmpresas: any[] = []
          for (const empId of todasIds) {
            const { data: emp, error: errEmp } = await sb
              .from('empresas')
              .select(SELECT_EMP)
              .eq('id', empId)
              .maybeSingle()
            console.log('[EmpresaCtx] empresa', empId, ':', emp ? 'OK' : 'null', errEmp ? errEmp.message : '')
            if (emp) todasEmpresas.push(emp)
          }"""

content = content.replace(old_busca, new_busca)
print("OK:", 'getSession' in content)
bal = content.count('{') - content.count('}')
print(f"Balanco: {bal}")
open('/home/claude/agendapro/src/context/EmpresaContext.tsx', 'w').write(content)
print("Salvo")
