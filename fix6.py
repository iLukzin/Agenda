content = open('/home/claude/agendapro/src/context/EmpresaContext.tsx').read()

old = """          // Buscar empresas com .or() - compativel com PostgREST
          const orFilter = todasIds.map((id: string) => `id.eq.${id}`).join(',')
          const { data: empsData } = await sb
            .from('empresas')
            .select(SELECT_EMP)
            .or(orFilter)
          const todasEmpresas: any[] = empsData || []"""

new = """          // Buscar cada empresa com .eq() + maybeSingle()
          const todasEmpresas: any[] = []
          for (const empId of todasIds) {
            const { data: emp } = await sb
              .from('empresas')
              .select(SELECT_EMP)
              .eq('id', empId)
              .maybeSingle()
            if (emp) todasEmpresas.push(emp)
          }"""

content = content.replace(old, new)
print("OK:", 'maybeSingle' in content)
bal = content.count('{') - content.count('}')
print(f"Balanco: {bal}")
open('/home/claude/agendapro/src/context/EmpresaContext.tsx', 'w').write(content)
print("Salvo")
