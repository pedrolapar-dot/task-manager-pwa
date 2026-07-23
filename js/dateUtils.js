const DIAS_SEMANA = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const DIAS_CURTOS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DIAS_SHORT  = ['dom','seg','ter','qua','qui','sex','sab'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function pad(n) { return String(n).padStart(2, '0'); }

function dataParaStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hoje() {
  return dataParaStr(new Date());
}

// Evita offset UTC: sempre usa T00:00:00 ao criar Date a partir de YYYY-MM-DD
export function parseData(str) {
  if (!str) return null;
  return new Date(`${str}T00:00:00`);
}

export function formatarData(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

export function formatarDataCurta(str) {
  if (!str) return '';
  const [, m, d] = str.split('-');
  return `${d}/${m}`;
}

export function formatarDiaSemana(str) {
  if (!str) return '';
  const d = parseData(str);
  return `${DIAS_SEMANA[d.getDay()]}, ${formatarDataCurta(str)}`;
}

export function diaDaSemanaIndex(str) {
  return parseData(str).getDay();
}

export function getDiaSemanaShort(str) {
  return DIAS_SHORT[parseData(str).getDay()];
}

export function getDiasCurtos() { return DIAS_CURTOS; }

// Semana começa na segunda-feira
export function getSemana(dateStr) {
  const d = parseData(dateStr || hoje());
  const dow = d.getDay();
  const diffParaSeg = dow === 0 ? -6 : 1 - dow;
  const seg = new Date(d);
  seg.setDate(d.getDate() + diffParaSeg);
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);
  return { inicio: dataParaStr(seg), fim: dataParaStr(dom) };
}

export function getMes(ano, mes) {
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia  = new Date(ano, mes + 1, 0);
  const dias = [];
  const offset = primeiroDia.getDay() === 0 ? 6 : primeiroDia.getDay() - 1;
  for (let i = offset; i > 0; i--) dias.push({ str: dataParaStr(new Date(ano, mes, 1 - i)), atual: false });
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push({ str: dataParaStr(new Date(ano, mes, d)), atual: true });
  const restantes = 42 - dias.length;
  for (let i = 1; i <= restantes; i++) dias.push({ str: dataParaStr(new Date(ano, mes + 1, i)), atual: false });
  return { ano, mes, nomeMes: MESES[mes], dias };
}

export function getNomeMes(mes) { return MESES[mes]; }
export function isHoje(str) { return str === hoje(); }

export function addDias(str, n) {
  const d = parseData(str);
  d.setDate(d.getDate() + n);
  return dataParaStr(d);
}

export function diasEntre(a, b) {
  return Math.round((parseData(b) - parseData(a)) / 86400000);
}

export function comparar(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function semanaLabel(inicio, fim) {
  return `${formatarDataCurta(inicio)} – ${formatarDataCurta(fim)}`;
}

export function mesAnterior(ano, mes) {
  return mes === 0 ? { ano: ano - 1, mes: 11 } : { ano, mes: mes - 1 };
}

export function mesProximo(ano, mes) {
  return mes === 11 ? { ano: ano + 1, mes: 0 } : { ano, mes: mes + 1 };
}

// ─── Recorrência ─────────────────────────────────────────────────────────────

/**
 * Expande um item recorrente gerando ocorrências virtuais no intervalo [inicio, fim].
 * Retorna array de objetos com _virtual:true e _dataOcorrencia preenchida.
 */
export function expandirRecorrencia(item, inicio, fim) {
  if (!item.recorrente || !item.recorrencia || !item.data) return [];

  const rec = item.recorrencia;
  const intervalo = Math.max(1, rec.intervalo || 1);
  const ignoradas  = item.ocorrenciasIgnoradas  || [];
  const concluidas = item.ocorrenciasConcluidas || [];
  const dataInicial = item.data;

  const limFim    = (rec.dataFim && rec.dataFim < fim) ? rec.dataFim : fim;
  const limInicio = dataInicial > inicio ? dataInicial : inicio;

  if (limInicio > limFim) return [];

  const candidatos = [];

  if (rec.frequencia === 'diaria') {
    const diff = diasEntre(dataInicial, limInicio);
    const passos = diff <= 0 ? 0 : Math.ceil(diff / intervalo);
    let cursor = addDias(dataInicial, passos * intervalo);
    while (cursor <= limFim) {
      if (!ignoradas.includes(cursor)) candidatos.push(cursor);
      cursor = addDias(cursor, intervalo);
    }

  } else if (rec.frequencia === 'semanal') {
    const diasAlvo = (rec.diasSemana && rec.diasSemana.length > 0)
      ? rec.diasSemana
      : [getDiaSemanaShort(dataInicial)];
    const semInicioRef = getSemana(dataInicial).inicio;

    let cursor = limInicio;
    while (cursor <= limFim) {
      if (diasAlvo.includes(getDiaSemanaShort(cursor))) {
        const semCursor = getSemana(cursor).inicio;
        const diffSem = Math.round(diasEntre(semInicioRef, semCursor) / 7);
        if (diffSem >= 0 && diffSem % intervalo === 0) {
          if (!ignoradas.includes(cursor)) candidatos.push(cursor);
        }
      }
      cursor = addDias(cursor, 1);
    }

  } else if (rec.frequencia === 'mensal') {
    const diaAlvo = rec.diaMes || parseInt(dataInicial.split('-')[2]);
    const [anoIni, mesIni] = dataInicial.split('-').map(Number);

    let cursor = limInicio;
    while (cursor <= limFim) {
      const [anoCursor, mesCursor, diaCursor] = cursor.split('-').map(Number);
      if (diaCursor === diaAlvo) {
        const diffMeses = (anoCursor - anoIni) * 12 + (mesCursor - mesIni);
        if (diffMeses >= 0 && diffMeses % intervalo === 0) {
          if (!ignoradas.includes(cursor)) candidatos.push(cursor);
        }
      }
      cursor = addDias(cursor, 1);
    }
  }

  return candidatos.map(d => ({
    ...item,
    data: d,
    _virtual: true,
    _dataOcorrencia: d,
    status: concluidas.includes(d) ? 'concluido' : item.status,
  }));
}

// Próxima ocorrência de um item recorrente a partir de uma data (inclusive).
// Retorna 'YYYY-MM-DD' ou null se não houver nos próximos ~3 meses.
export function proximaOcorrencia(item, aPartirDe) {
  const ocs = expandirRecorrencia(item, aPartirDe, addDias(aPartirDe, 92));
  return ocs.length ? ocs[0]._dataOcorrencia : null;
}
