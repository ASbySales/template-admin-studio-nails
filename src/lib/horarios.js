export const DIAS_SEMANA_COMPLETOS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

export const PADRAO_PERIODOS_SEMANA = [
  '07:00 - 09:30',
  '09:30 - 12:00',
  '13:00 - 15:30',
  '15:30 - 18:00',
]

export const PADRAO_PERIODOS_SABADO = PADRAO_PERIODOS_SEMANA.slice(0, 2)

export const PADRAO_CONFIG_SEMANA = [
  { dia_semana: 0, ativo: false, periodos: [...PADRAO_PERIODOS_SABADO] },
  { dia_semana: 1, ativo: true, periodos: [...PADRAO_PERIODOS_SEMANA] },
  { dia_semana: 2, ativo: true, periodos: [...PADRAO_PERIODOS_SEMANA] },
  { dia_semana: 3, ativo: true, periodos: [...PADRAO_PERIODOS_SEMANA] },
  { dia_semana: 4, ativo: true, periodos: [...PADRAO_PERIODOS_SEMANA] },
  { dia_semana: 5, ativo: true, periodos: [...PADRAO_PERIODOS_SEMANA] },
  { dia_semana: 6, ativo: true, periodos: [...PADRAO_PERIODOS_SABADO] },
]

export const PADRAO_CONFIG_AGENDA = {
  semana: PADRAO_CONFIG_SEMANA,
  datas_especiais: [],
}

const pad2 = (n) => String(n).padStart(2, '0')

export function parsePeriodoMinutos(str) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/.exec(
    String(str || '').trim()
  )
  if (!m) return null
  const h1 = Number(m[1])
  const m1 = Number(m[2])
  const h2 = Number(m[3])
  const m2 = Number(m[4])
  const ini = h1 * 60 + m1
  const fim = h2 * 60 + m2
  if (ini >= fim) return null
  return {
    id: `${pad2(h1)}:${pad2(m1)} - ${pad2(h2)}:${pad2(m2)}`,
    ini,
    fim,
    turno: ini < 12 * 60 ? 'Manhã' : ini < 18 * 60 ? 'Tarde' : 'Noite',
  }
}

export function periodosConflitam(a, b) {
  if (!a || !b) return false
  if (String(a).trim() === String(b).trim()) return true
  const pa = parsePeriodoMinutos(a)
  const pb = parsePeriodoMinutos(b)
  if (!pa || !pb) return false
  return pa.ini < pb.fim && pb.ini < pa.fim
}

export function ordenarValidarPeriodos(lista = []) {
  const parsed = []
  for (const raw of lista) {
    const p = parsePeriodoMinutos(raw)
    if (!p) {
      throw new Error(`Horário inválido "${raw}". Use HH:MM - HH:MM com início menor que o fim.`)
    }
    parsed.push(p)
  }
  parsed.sort((a, b) => a.ini - b.ini || a.fim - b.fim)
  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i - 1].fim > parsed[i].ini) {
      throw new Error(`Os horários "${parsed[i - 1].id}" e "${parsed[i].id}" estão sobrepostos.`)
    }
  }
  return parsed.map((p) => p.id)
}

export function normalizarConfigAgenda(raw) {
  const base = PADRAO_CONFIG_SEMANA.map((d) => ({ ...d, periodos: [...d.periodos] }))
  if (Array.isArray(raw?.semana)) {
    raw.semana.forEach((item) => {
      const dow = Number(item?.dia_semana)
      if (Number.isInteger(dow) && dow >= 0 && dow <= 6) {
        base[dow] = {
          dia_semana: dow,
          ativo: Boolean(item.ativo),
          periodos: Array.isArray(item.periodos) ? item.periodos.filter(Boolean) : [],
        }
      }
    })
  }
  const especiais = Array.isArray(raw?.datas_especiais)
    ? raw.datas_especiais
        .filter((e) => e && e.data)
        .map((e) => ({
          data: String(e.data).slice(0, 10),
          ativo: Boolean(e.ativo),
          periodos: Array.isArray(e.periodos) ? e.periodos.filter(Boolean) : [],
          motivo: e.motivo || '',
        }))
        .sort((a, b) => a.data.localeCompare(b.data))
    : []
  return { semana: base, datas_especiais: especiais }
}

export function obterDataHojeIsoSP() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export function obterDiaSemanaIso(dataIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataIso || '').trim())
  if (!m) return -1
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)).getUTCDay()
}

export function obterConfigDoDia(dataIso, configAgenda = PADRAO_CONFIG_AGENDA) {
  const isoLimpo = String(dataIso || '').slice(0, 10)
  const esp = (configAgenda?.datas_especiais || []).find((e) => e.data === isoLimpo)
  if (esp) {
    return {
      ativo: Boolean(esp.ativo) && Array.isArray(esp.periodos) && esp.periodos.length > 0,
      periodos: esp.ativo ? esp.periodos || [] : [],
      origem: 'especial',
      motivo: esp.motivo || '',
    }
  }
  const dow = obterDiaSemanaIso(isoLimpo)
  if (dow < 0) return { ativo: false, periodos: [], origem: 'invalido', motivo: '' }
  const sem =
    (configAgenda?.semana || PADRAO_CONFIG_SEMANA).find((d) => Number(d.dia_semana) === dow) ||
    PADRAO_CONFIG_SEMANA[dow]
  const lista = sem?.ativo ? sem.periodos || [] : []
  return {
    ativo: Boolean(sem?.ativo) && lista.length > 0,
    periodos: lista,
    origem: 'semana',
    motivo: '',
  }
}

export function obterHorariosDoDia(dataIso, configAgenda = PADRAO_CONFIG_AGENDA) {
  const cfg = obterConfigDoDia(dataIso, configAgenda)
  if (!cfg.ativo) return []
  return cfg.periodos.map((txt) => parsePeriodoMinutos(txt)).filter(Boolean)
}

export function formatarDataIsoBr(dataIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dataIso || '').trim())
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}
