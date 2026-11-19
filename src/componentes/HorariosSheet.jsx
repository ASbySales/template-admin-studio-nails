import { useMemo, useState } from 'react'
import { AlertTriangle, Calendar, Clock, Copy, Loader2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAdminUI } from '../lib/adminUi'
import {
  DIAS_SEMANA_COMPLETOS,
  formatarDataIsoBr,
  normalizarConfigAgenda,
  obterConfigDoDia,
  obterDataHojeIsoSP,
  ordenarValidarPeriodos,
  parsePeriodoMinutos,
} from '../lib/horarios'
import { Sheet } from './AppLayout'

function proximaSugestaoHorario(periodos = []) {
  if (!periodos.length) return { ini: '07:00', fim: '09:30' }
  const ultimo = parsePeriodoMinutos(periodos[periodos.length - 1])
  if (!ultimo) return { ini: '09:30', fim: '12:00' }
  const iniMin = ultimo.fim
  const fimMin = Math.min(23 * 60 + 30, iniMin + 150)
  const fmt = (m) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return {
    ini: iniMin < 23 * 60 ? fmt(iniMin) : '07:00',
    fim: iniMin < fimMin ? fmt(fimMin) : '09:30',
  }
}

export default function HorariosSheet({
  tenantId,
  tenantNome,
  configAgenda,
  solicitacoes,
  onSalvo,
  aoFechar,
}) {
  const { avisar } = useAdminUI()
  const [aba, setAba] = useState('semana')
  const [semana, setSemana] = useState(() =>
    (configAgenda?.semana || []).map((d) => ({
      dia_semana: Number(d.dia_semana),
      ativo: Boolean(d.ativo),
      periodos: [...(d.periodos || [])],
    }))
  )
  const [datasEspeciais, setDatasEspeciais] = useState(() =>
    (configAgenda?.datas_especiais || []).map((e) => ({
      data: e.data,
      ativo: Boolean(e.ativo),
      periodos: [...(e.periodos || [])],
      motivo: e.motivo || '',
    }))
  )

  const [diaExpandido, setDiaExpandido] = useState(1)
  const [horaIni, setHoraIni] = useState('07:00')
  const [horaFim, setHoraFim] = useState('09:30')

  const hojeIso = obterDataHojeIsoSP()
  const [espData, setEspData] = useState('')
  const [espAtivo, setEspAtivo] = useState(false)
  const [espMotivo, setEspMotivo] = useState('')
  const [espPeriodos, setEspPeriodos] = useState(['09:00 - 12:00'])
  const [espIni, setEspIni] = useState('09:00')
  const [espFim, setEspFim] = useState('12:00')

  const [salvando, setSalvando] = useState(false)
  const [erroLocal, setErroLocal] = useState('')

  const abrirDia = (dow) => {
    setErroLocal('')
    if (diaExpandido === dow) {
      setDiaExpandido(null)
      return
    }
    setDiaExpandido(dow)
    const obj = semana.find((d) => d.dia_semana === dow)
    const sug = proximaSugestaoHorario(obj?.periodos || [])
    setHoraIni(sug.ini)
    setHoraFim(sug.fim)
  }

  const alternarDiaAtivo = (dow, ativo) => {
    setErroLocal('')
    setSemana((prev) =>
      prev.map((d) => {
        if (d.dia_semana !== dow) return d
        const base =
          ativo && d.periodos.length === 0 ? ['07:00 - 09:30', '09:30 - 12:00'] : d.periodos
        return { ...d, ativo, periodos: base }
      })
    )
    if (ativo) setDiaExpandido(dow)
  }

  const adicionarPeriodoDia = (dow) => {
    setErroLocal('')
    const diaAtual = semana.find((d) => d.dia_semana === dow)
    if (!diaAtual) return
    try {
      const ord = ordenarValidarPeriodos([...diaAtual.periodos, `${horaIni} - ${horaFim}`])
      setSemana((prev) =>
        prev.map((d) => (d.dia_semana === dow ? { ...d, ativo: true, periodos: ord } : d))
      )
      const sug = proximaSugestaoHorario(ord)
      setHoraIni(sug.ini)
      setHoraFim(sug.fim)
    } catch (err) {
      setErroLocal(err.message)
    }
  }

  const removerPeriodoDia = (dow, idx) => {
    setErroLocal('')
    setSemana((prev) =>
      prev.map((d) => {
        if (d.dia_semana !== dow) return d
        const rest = d.periodos.filter((_, i) => i !== idx)
        return { ...d, ativo: rest.length > 0 ? d.ativo : false, periodos: rest }
      })
    )
  }

  const copiarParaSegSex = (origemDow) => {
    const origem = semana.find((d) => d.dia_semana === origemDow)
    if (!origem) return
    setErroLocal('')
    setSemana((prev) =>
      prev.map((d) =>
        d.dia_semana >= 1 && d.dia_semana <= 5
          ? { ...d, ativo: origem.ativo, periodos: [...origem.periodos] }
          : d
      )
    )
    avisar('Grade copiada para segunda a sexta-feira.')
  }

  const adicionarPeriodoEspecial = () => {
    setErroLocal('')
    try {
      const ord = ordenarValidarPeriodos([...espPeriodos, `${espIni} - ${espFim}`])
      setEspPeriodos(ord)
      const sug = proximaSugestaoHorario(ord)
      setEspIni(sug.ini)
      setEspFim(sug.fim)
    } catch (err) {
      setErroLocal(err.message)
    }
  }

  const adicionarDataEspecial = () => {
    setErroLocal('')
    if (!espData) {
      setErroLocal('Selecione uma data.')
      return
    }
    if (espAtivo && espPeriodos.length === 0) {
      setErroLocal('Adicione ao menos um período ou marque como dia fechado.')
      return
    }
    try {
      const periodosOk = espAtivo ? ordenarValidarPeriodos(espPeriodos) : []
      setDatasEspeciais((prev) =>
        [
          ...prev.filter((x) => x.data !== espData),
          {
            data: espData,
            ativo: espAtivo,
            periodos: periodosOk,
            motivo: espMotivo.trim(),
          },
        ].sort((a, b) => a.data.localeCompare(b.data))
      )
      setEspData('')
      setEspMotivo('')
    } catch (err) {
      setErroLocal(err.message)
    }
  }

  const afetados = useMemo(() => {
    const draft = { semana, datas_especiais: datasEspeciais }
    return (solicitacoes || []).filter((s) => {
      if (!s.data_agendamento || !['pendente', 'aprovado'].includes(s.status)) return false
      const dataIso = String(s.data_agendamento).slice(0, 10)
      if (dataIso < hojeIso) return false
      const cfg = obterConfigDoDia(dataIso, draft)
      if (!cfg.ativo) return true
      if (s.horario_agendamento && !cfg.periodos.includes(s.horario_agendamento)) return true
      return false
    })
  }, [solicitacoes, semana, datasEspeciais, hojeIso])

  const handleSalvar = async () => {
    setErroLocal('')
    setSalvando(true)
    try {
      const semanaLimpa = semana.map((d) => {
        const periodosOrdenados = ordenarValidarPeriodos(d.periodos || [])
        return {
          dia_semana: d.dia_semana,
          ativo: Boolean(d.ativo) && periodosOrdenados.length > 0,
          periodos: periodosOrdenados,
        }
      })

      const especiaisLimpas = datasEspeciais.map((e) => {
        const periodosOrdenados = e.ativo ? ordenarValidarPeriodos(e.periodos || []) : []
        return {
          data: e.data,
          ativo: Boolean(e.ativo) && periodosOrdenados.length > 0,
          periodos: periodosOrdenados,
          motivo: e.motivo.trim() || null,
        }
      })

      const atuais = (configAgenda?.datas_especiais || []).map((e) => e.data)
      const mantidas = new Set(especiaisLimpas.map((e) => e.data))
      const removidas = atuais.filter((d) => !mantidas.has(d))

      const { data, error } = await supabase.rpc('salvar_config_horarios_tenant', {
        p_tenant_id: tenantId,
        p_semana: semanaLimpa,
        p_datas_especiais: especiaisLimpas,
        p_datas_especiais_removidas: removidas,
      })
      if (error) throw error

      avisar('Horários de atendimento atualizados!')
      onSalvo?.(normalizarConfigAgenda(data))
      aoFechar()
    } catch (err) {
      console.error('Erro ao salvar horários:', err)
      const msg = String(err?.message || '')
      if (err?.code === 'PGRST202' || /could not find the function/i.test(msg)) {
        setErroLocal(
          'A função de horários dinâmicos ainda não foi aplicada no banco da AS Gestão (execute a migration 20261119_config_horarios_estudio.sql).'
        )
      } else {
        setErroLocal(msg || 'Erro ao salvar horários.')
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Sheet
      titulo="Horários de Atendimento"
      subtitulo={`${tenantNome || tenantId} · Dias da semana, períodos e feriados`}
      cheio
      z={70}
      aoFechar={aoFechar}
      rodape={
        <button
          type="button"
          disabled={salvando}
          onClick={handleSalvar}
          className="w-full h-12 rounded-2xl text-white font-bold text-sm shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ backgroundColor: 'var(--as-accent)' }}
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Salvar Horários no Sistema</span>}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAba('semana')}
            className={`py-2.5 rounded-2xl text-xs font-bold cursor-pointer transition ${
              aba === 'semana' ? 'text-white shadow-xs' : 'bg-white border border-[var(--as-soft)] text-gray-600'
            }`}
            style={aba === 'semana' ? { backgroundColor: 'var(--as-accent)' } : undefined}
          >
            Semana (Dom–Sáb)
          </button>
          <button
            type="button"
            onClick={() => setAba('especiais')}
            className={`py-2.5 rounded-2xl text-xs font-bold cursor-pointer transition ${
              aba === 'especiais' ? 'text-white shadow-xs' : 'bg-white border border-[var(--as-soft)] text-gray-600'
            }`}
            style={aba === 'especiais' ? { backgroundColor: 'var(--as-accent)' } : undefined}
          >
            Feriados / Datas ({datasEspeciais.length})
          </button>
        </div>

        {erroLocal && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-700 text-left">
            ⚠️ {erroLocal}
          </div>
        )}

        {afetados.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-900 flex items-start gap-2 text-left">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>{afetados.length} agendamento(s) futuro(s)</strong> ficam fora da nova grade (ex.:{' '}
              {afetados[0].nome_cliente?.split(' ')[0] || 'Cliente'} em{' '}
              {formatarDataIsoBr(afetados[0].data_agendamento)}). Eles permanecerão preservados no sistema.
            </span>
          </div>
        )}

        {aba === 'semana' ? (
          <div className="flex flex-col gap-2">
            {semana.map((dia) => {
              const aberto = diaExpandido === dia.dia_semana
              return (
                <div
                  key={dia.dia_semana}
                  className="rounded-2xl border border-[var(--as-card-border)] overflow-hidden bg-white"
                >
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => abrirDia(dia.dia_semana)}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <span className="block text-xs font-bold text-gray-800">
                        {DIAS_SEMANA_COMPLETOS[dia.dia_semana]}
                      </span>
                      <span
                        className={`block text-[11px] truncate ${
                          dia.ativo && dia.periodos.length
                            ? 'text-emerald-700 font-semibold'
                            : 'text-gray-400'
                        }`}
                      >
                        {dia.ativo && dia.periodos.length
                          ? `${dia.periodos.length} período(s): ${dia.periodos.join(', ')}`
                          : 'Fechado'}
                      </span>
                    </button>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-600 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={dia.ativo}
                        onChange={(e) => alternarDiaAtivo(dia.dia_semana, e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-[var(--as-accent)]"
                      />
                      <span>{dia.ativo ? 'Aberto' : 'Fechado'}</span>
                    </label>
                  </div>

                  {aberto && (
                    <div className="px-3.5 pb-3.5 pt-2.5 border-t border-gray-100 bg-gray-50/60 flex flex-col gap-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {dia.periodos.map((per, idx) => (
                          <span
                            key={per}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-[var(--as-soft)] px-2.5 py-1 text-xs font-bold text-gray-800"
                          >
                            <Clock className="w-3 h-3" style={{ color: 'var(--as-accent)' }} />
                            <span>{per}</span>
                            <button
                              type="button"
                              onClick={() => removerPeriodoDia(dia.dia_semana, idx)}
                              className="text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-gray-500">Início</span>
                          <input
                            type="time"
                            value={horaIni}
                            onChange={(e) => setHoraIni(e.target.value)}
                            className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)]"
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-gray-500">Fim</span>
                          <input
                            type="time"
                            value={horaFim}
                            onChange={(e) => setHoraFim(e.target.value)}
                            className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => adicionarPeriodoDia(dia.dia_semana)}
                          className="px-3 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95 transition"
                          style={{ backgroundColor: 'var(--as-accent)' }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => copiarParaSegSex(dia.dia_semana)}
                        className="w-full py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-95 transition"
                        style={{
                          backgroundColor: 'var(--as-blush)',
                          color: 'var(--as-accent-deep)',
                        }}
                      >
                        <Copy className="w-3 h-3" /> Copiar esta grade para Seg–Sex
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-[var(--as-card-border)] p-3.5 bg-white flex flex-col gap-2.5">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--as-accent)' }} /> Nova exceção por data
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="date"
                  min={hojeIso}
                  value={espData}
                  onChange={(e) => setEspData(e.target.value)}
                  className="px-3 py-2 text-xs bg-gray-50/70 border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)]"
                />
                <input
                  type="text"
                  placeholder="Motivo (ex: Feriado)"
                  value={espMotivo}
                  onChange={(e) => setEspMotivo(e.target.value)}
                  className="px-3 py-2 text-xs bg-gray-50/70 border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--as-accent)]"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={espAtivo}
                  onChange={(e) => setEspAtivo(e.target.checked)}
                  className="w-4 h-4 accent-[var(--as-accent)]"
                />
                <span>
                  {espAtivo
                    ? 'Abrir com horários especiais neste dia'
                    : 'Fechar o dia inteiro (folga/feriado)'}
                </span>
              </label>

              {espAtivo && (
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1.5">
                    {espPeriodos.map((per, idx) => (
                      <span
                        key={per}
                        className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-bold"
                      >
                        {per}
                        <button
                          type="button"
                          onClick={() => setEspPeriodos((p) => p.filter((_, i) => i !== idx))}
                          className="text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="time"
                      value={espIni}
                      onChange={(e) => setEspIni(e.target.value)}
                      className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl"
                    />
                    <input
                      type="time"
                      value={espFim}
                      onChange={(e) => setEspFim(e.target.value)}
                      className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={adicionarPeriodoEspecial}
                      className="px-3 py-1.5 rounded-xl border border-gray-300 bg-white text-xs font-bold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={adicionarDataEspecial}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold cursor-pointer hover:bg-gray-800 transition"
              >
                Adicionar exceção à lista
              </button>
            </div>

            {datasEspeciais.map((esp) => (
              <div
                key={esp.data}
                className="rounded-2xl border border-[var(--as-card-border)] p-3 flex items-center justify-between bg-white"
              >
                <div>
                  <p className="text-xs font-bold text-gray-800">
                    {formatarDataIsoBr(esp.data)} {esp.motivo ? `· ${esp.motivo}` : ''}
                  </p>
                  <p className={`text-[11px] font-semibold ${esp.ativo ? 'text-emerald-700' : 'text-red-600'}`}>
                    {esp.ativo ? esp.periodos.join(', ') : 'Dia fechado'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDatasEspeciais((prev) => prev.filter((x) => x.data !== esp.data))}
                  className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
