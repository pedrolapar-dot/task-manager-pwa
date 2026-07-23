// ─── Exportação para calendário (.ics) ───────────────────────────────────────
// Gera arquivos iCalendar que o iPhone/Mac/Google Calendar importam nativamente.
// Itens recorrentes viram eventos com RRULE (uma importação cobre a série toda)
// e itens com horário ganham alerta 15 minutos antes.

import { expandirRecorrencia, addDias } from './dateUtils.js';

const DIA_BYDAY = { dom: 'SU', seg: 'MO', ter: 'TU', qua: 'WE', qui: 'TH', sex: 'FR', sab: 'SA' };

function dt(data, hora) {
  return data.replace(/-/g, '') + (hora ? 'T' + hora.replace(':', '') + '00' : '');
}

function escaparICS(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function somarMinutos(hm, n) {
  const [h, m] = hm.split(':').map(Number);
  const t = h * 60 + m + n;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function eventoICS(item) {
  if (!item.data) return null;

  const linhas  = ['BEGIN:VEVENT', `UID:${item.id}@task-manager-pwa`, `SUMMARY:${escaparICS(item.titulo)}`];
  const comHora = !!item.horaInicio;

  // Recorrente: DTSTART precisa cair na PRIMEIRA ocorrência real (a data de
  // criação pode não bater com a regra — ex.: criado na quarta, repete às
  // quintas — e alguns calendários criariam um evento avulso errado).
  let dataEvento = item.data;
  if (item.recorrente && item.recorrencia) {
    const primeira = expandirRecorrencia(item, item.data, addDias(item.data, 366))[0];
    if (primeira) dataEvento = primeira._dataOcorrencia;
  }

  if (comHora) {
    linhas.push(`DTSTART:${dt(dataEvento, item.horaInicio)}`);
    linhas.push(`DTEND:${dt(dataEvento, item.horaFim || somarMinutos(item.horaInicio, 60))}`);
  } else {
    linhas.push(`DTSTART;VALUE=DATE:${dt(dataEvento)}`);
  }

  if (item.recorrente && item.recorrencia) {
    const r = item.recorrencia;
    const n = Math.max(1, r.intervalo || 1);
    let rule = '';
    if (r.frequencia === 'diaria') {
      rule = `FREQ=DAILY;INTERVAL=${n}`;
    } else if (r.frequencia === 'semanal') {
      const dias = (r.diasSemana || []).map(d => DIA_BYDAY[d]).filter(Boolean);
      rule = `FREQ=WEEKLY;INTERVAL=${n}` + (dias.length ? `;BYDAY=${dias.join(',')}` : '');
    } else if (r.frequencia === 'mensal') {
      rule = `FREQ=MONTHLY;INTERVAL=${n}` + (r.diaMes ? `;BYMONTHDAY=${r.diaMes}` : '');
    }
    if (rule) {
      if (r.dataFim) rule += `;UNTIL=${dt(r.dataFim, '23:59')}`;
      linhas.push(`RRULE:${rule}`);
      (item.ocorrenciasIgnoradas || []).forEach(d => {
        linhas.push(comHora ? `EXDATE:${dt(d, item.horaInicio)}` : `EXDATE;VALUE=DATE:${dt(d)}`);
      });
    }
  }

  if (item.descricao) linhas.push(`DESCRIPTION:${escaparICS(item.descricao)}`);

  if (comHora) {
    linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY',
      `DESCRIPTION:${escaparICS(item.titulo)}`, 'TRIGGER:-PT15M', 'END:VALARM');
  }

  linhas.push('END:VEVENT');
  return linhas.join('\r\n');
}

function montarCalendario(eventos) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Task Manager PWA//PT-BR',
    'CALSCALE:GREGORIAN',
    ...eventos,
    'END:VCALENDAR',
  ].join('\r\n');
}

function baixar(conteudo, nomeArquivo) {
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nomeArquivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Baixa um único item como evento de calendário. Retorna false se sem data.
export function baixarICSItem(item) {
  const ev = eventoICS(item);
  if (!ev) return false;
  const nome = item.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'evento';
  baixar(montarCalendario([ev]), `${nome}.ics`);
  return true;
}

// Baixa a agenda inteira (itens com data e ainda em aberto). Retorna quantos.
export function baixarAgendaICS(items) {
  const abertos = ['backlog', 'ativo', 'em_andamento', 'aguardando', 'pausado'];
  const eventos = items
    .filter(i => i.data && abertos.includes(i.status))
    .map(eventoICS)
    .filter(Boolean);
  if (eventos.length === 0) return 0;
  baixar(montarCalendario(eventos), 'minha-agenda.ics');
  return eventos.length;
}
