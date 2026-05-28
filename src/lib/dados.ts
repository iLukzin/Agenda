// BUILD: 1779992105
// ============================================================
// Dados compartilhados entre páginas
// Em produção estes dados viriam do Supabase
// ============================================================

export type HorarioProfissional = {
  dia: number      // 0=Dom, 1=Seg ... 6=Sáb
  inicio: string   // "08:00"
  fim: string      // "18:00"
  ativo: boolean
}

export type Profissional = {
  id: string
  nome: string
  email: string
  telefone: string
  especialidade: string
  servicos: string[]
  cor: string
  status: string
  horarios: HorarioProfissional[]
}

export type ClienteCadastro = {
  id: string
  nome: string
  telefone: string
  whatsapp: string
  plano: string
}

// Horário padrão: seg?sex 08:00?18:00
const horariosBase: HorarioProfissional[] = [
  { dia:0, inicio:'08:00', fim:'18:00', ativo:false },
  { dia:1, inicio:'08:00', fim:'18:00', ativo:true  },
  { dia:2, inicio:'08:00', fim:'18:00', ativo:true  },
  { dia:3, inicio:'08:00', fim:'18:00', ativo:true  },
  { dia:4, inicio:'08:00', fim:'18:00', ativo:true  },
  { dia:5, inicio:'08:00', fim:'18:00', ativo:true  },
  { dia:6, inicio:'08:00', fim:'13:00', ativo:false },
]

export const PROFISSIONAIS_CADASTRO: Profissional[] = [
  {
    id:'1', nome:'Dr. Carlos Souza', email:'carlos@studio.com', telefone:'(11) 99999-0010',
    especialidade:'Terapeuta', servicos:['Consulta','Retorno','Sessão Terapêutica'],
    cor:'#6366f1', status:'ativo',
    horarios: [
      { dia:0, inicio:'08:00', fim:'18:00', ativo:false },
      { dia:1, inicio:'08:00', fim:'18:00', ativo:true  },
      { dia:2, inicio:'08:00', fim:'18:00', ativo:true  },
      { dia:3, inicio:'08:00', fim:'18:00', ativo:true  },
      { dia:4, inicio:'08:00', fim:'18:00', ativo:true  },
      { dia:5, inicio:'08:00', fim:'17:00', ativo:true  },
      { dia:6, inicio:'08:00', fim:'12:00', ativo:false },
    ],
  },
  {
    id:'2', nome:'Dra. Ana Lima', email:'ana@studio.com', telefone:'(11) 99999-0011',
    especialidade:'Fisioterapeuta', servicos:['Consulta','Avaliação'],
    cor:'#06b6d4', status:'ativo',
    horarios: [
      { dia:0, inicio:'08:00', fim:'18:00', ativo:false },
      { dia:1, inicio:'09:00', fim:'18:00', ativo:true  },
      { dia:2, inicio:'09:00', fim:'18:00', ativo:true  },
      { dia:3, inicio:'09:00', fim:'18:00', ativo:false },
      { dia:4, inicio:'09:00', fim:'18:00', ativo:true  },
      { dia:5, inicio:'09:00', fim:'17:00', ativo:true  },
      { dia:6, inicio:'09:00', fim:'12:00', ativo:true  },
    ],
  },
  {
    id:'3', nome:'Dr. Pedro Costa', email:'pedro@studio.com', telefone:'(11) 99999-0012',
    especialidade:'Psicólogo', servicos:['Consulta','Sessão Terapêutica'],
    cor:'#10b981', status:'ativo',
    horarios: [
      { dia:0, inicio:'08:00', fim:'18:00', ativo:false },
      { dia:1, inicio:'10:00', fim:'19:00', ativo:true  },
      { dia:2, inicio:'10:00', fim:'19:00', ativo:true  },
      { dia:3, inicio:'10:00', fim:'19:00', ativo:true  },
      { dia:4, inicio:'10:00', fim:'19:00', ativo:true  },
      { dia:5, inicio:'10:00', fim:'16:00', ativo:false },
      { dia:6, inicio:'08:00', fim:'12:00', ativo:false },
    ],
  },
  {
    id:'4', nome:'Dra. Sofia Mendes', email:'sofia@studio.com', telefone:'(11) 99999-0013',
    especialidade:'Nutricionista', servicos:['Avaliação','Retorno'],
    cor:'#ec4899', status:'inativo',
    horarios: horariosBase.map(h => ({...h})),
  },
]

export const CLIENTES_CADASTRO: ClienteCadastro[] = [
  { id:'1', nome:'Maria Silva',    telefone:'(11) 99999-0001', whatsapp:'(11) 99998-0001', plano:'Plano 8 sessões' },
  { id:'2', nome:'João Santos',    telefone:'(11) 99999-0002', whatsapp:'',                plano:'Avulso'          },
  { id:'3', nome:'Ana Costa',      telefone:'(11) 99999-0003', whatsapp:'(11) 99998-0003', plano:'Plano 4 sessões' },
  { id:'4', nome:'Pedro Oliveira', telefone:'(11) 99999-0004', whatsapp:'',                plano:'Plano Ilimitado' },
  { id:'5', nome:'Lucia Ferreira', telefone:'(11) 99999-0005', whatsapp:'(11) 99998-0005', plano:'Avulso'          },
  { id:'6', nome:'Carlos Mendes',  telefone:'(11) 99999-0006', whatsapp:'',                plano:'Plano 8 sessões' },
  { id:'7', nome:'Sofia Lima',     telefone:'(11) 99999-0007', whatsapp:'(11) 99998-0007', plano:'Avulso'          },
]

// ?? Helpers de horário ????????????????????????????????????????

// Dado um profissional e uma data ISO, retorna o horário daquele dia
// ou null se o profissional não atende naquele dia da semana
export function horarioDoDia(
  prof: Profissional,
  dataISO: string
): HorarioProfissional | null {
  const [y, m, d] = dataISO.split('-').map(Number)
  const data = new Date(y, m - 1, d)
  const dow  = data.getDay() // 0=Dom, 6=Sáb
  const h    = prof.horarios.find(h => h.dia === dow)
  return h?.ativo ? h : null
}

// Converte "HH:MM" em minutos desde meia-noite
export function horaParaMin(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// Gera lista de horários disponíveis para um profissional num dia,
// com intervalo de X minutos, excluindo os já ocupados
export function horariosDisponiveis(
  prof: Profissional,
  dataISO: string,
  duracaoMin: number,
  agendamentosExistentes: { dataISO: string; horaInicio: number; duracao: number; profissional: string; status: string; id: number }[],
  idExcluir?: number
): { hora: number; horaStr: string; disponivel: boolean; motivo?: string }[] {
  const horarioDia = horarioDoDia(prof, dataISO)

  if (!horarioDia) return [] // profissional não atende neste dia

  const inicioMin = horaParaMin(horarioDia.inicio)
  const fimMin    = horaParaMin(horarioDia.fim)

  // Agendamentos do profissional naquele dia (exceto cancelados)
  const ags = agendamentosExistentes.filter(a =>
    a.dataISO === dataISO &&
    a.profissional === prof.nome &&
    a.status !== 'cancelado' &&
    a.id !== idExcluir
  )

  const resultado: { hora: number; horaStr: string; disponivel: boolean; motivo?: string }[] = []

  // Gera slots de hora em hora dentro do horário do profissional
  for (let min = inicioMin; min + duracaoMin <= fimMin; min += 60) {
    const hora    = Math.floor(min / 60)
    const horaStr = `${String(hora).padStart(2, '0')}:00`

    // Verifica se há conflito com algum agendamento existente
    const conflito = ags.find(a => {
      const agInicioMin = a.horaInicio * 60
      const agFimMin    = agInicioMin + a.duracao
      const slotFimMin  = min + duracaoMin
      // sobreposição: slot começa antes do fim do ag E termina depois do início do ag
      return min < agFimMin && slotFimMin > agInicioMin
    })

    resultado.push({
      hora,
      horaStr,
      disponivel: !conflito,
      motivo: conflito ? conflito.horaInicio.toString() : undefined,
    })
  }

  return resultado
}
