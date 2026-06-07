content = open('/home/claude/agendapro/src/context/EmpresaContext.tsx').read()

old_query = """          // Buscar cada empresa individualmente (evita erro 400 do .in())
          const empsArr: any[] = []
          for (const empId of todasIds) {
            const { data: empData } = await sb
              .from('empresas').select(SELECT_EMP).eq('id', empId).single()
            if (empData) empsArr.push(empData)
          }
          const todasEmpresas: any[] = empsArr"""

new_query = """          // Buscar empresas com .or() - compativel com PostgREST
          const orFilter = todasIds.map((id: string) => `id.eq.${id}`).join(',')
          const { data: empsData } = await sb
            .from('empresas')
            .select(SELECT_EMP)
            .or(orFilter)
          const todasEmpresas: any[] = empsData || []"""

content = content.replace(old_query, new_query)
print("OK:", 'orFilter' in content)
bal = content.count('{') - content.count('}')
print(f"Balanco: {bal}")
open('/home/claude/agendapro/src/context/EmpresaContext.tsx', 'w').write(content)
print("Salvo")
