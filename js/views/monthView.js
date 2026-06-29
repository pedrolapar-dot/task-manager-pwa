import { db } from '../db.js';
import { getMes, mesAnterior, mesProximo, isHoje, formatarDataCurta, expandirRecorrencia } from '../dateUtils.js';
import { renderCard } from '../components/card.js';

const TIPO_MARKER = {
  reuniao: 'marker-reuniao', entrega: 'marker-entrega', feriado: 'marker-feriado',
  projeto: 'marker-projeto', evento: 'marker-evento', tarefa: 'marker-tarefa',
  lembrete: 'marker-lembrete',
};

export function render(container, state) {
  const { ano, mes, nomeMes, dias } = getMes(state.mesAtual.ano, state.mesAtual.mes);

  // Primeiro e último dia do grid (pode incluir dias de meses adjacentes)
  const gridInicio = dias[0].str;
  const gridFim    = dias[dias.length - 1].str;

  // Itens regulares do mês
  const regular  = db.getByMes(ano, mes);
  // Ocorrências virtuais para todo o grid do mês
  const virtuais = db.getRecorrentes().flatMap(i => expandirRecorrencia(i, gridInicio, gridFim));
  const todos    = [...regular, ...virtuais];

  // Agrupa por data
  const porDia = {};
  todos.forEach(item => {
    const d = item.data || item.prazo;
    if (d) {
      if (!porDia[d]) porDia[d] = [];
      if (!porDia[d].find(i => i.id === item.id && i._dataOcorrencia === item._dataOcorrencia))
        porDia[d].push(item);
    }
  });

  container.innerHTML = `
    <div class="month-view">
      <div class="view-header">
        <button class="btn-nav" id="btn-prev-month" aria-label="Mês anterior">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 class="view-titulo">${nomeMes} ${ano}</h1>
        <button class="btn-nav" id="btn-next-month" aria-label="Próximo mês">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="month-cabecalho-dias">
        ${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => `<div class="month-col-header">${d}</div>`).join('')}
      </div>

      <div class="month-grid">
        ${dias.map(({ str, atual }) => {
          const dayItems = porDia[str] || [];
          const markers  = dayItems.slice(0, 4).map(item => {
            const cls = TIPO_MARKER[item.tipo] || 'marker-tarefa';
            return `<span class="day-marker ${cls}"></span>`;
          }).join('');
          return `
            <div class="month-day${!atual ? ' month-day-outro-mes' : ''}${isHoje(str) ? ' month-day-hoje' : ''}"
                 data-date="${str}">
              <span class="month-day-num">${parseInt(str.split('-')[2])}</span>
              <div class="day-markers">${markers}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="month-detail hidden" id="month-detail"></div>
    </div>
  `;

  document.getElementById('btn-prev-month').addEventListener('click', () => {
    state.mesAtual = mesAnterior(ano, mes);
    render(container, state);
  });

  document.getElementById('btn-next-month').addEventListener('click', () => {
    state.mesAtual = mesProximo(ano, mes);
    render(container, state);
  });

  container.querySelectorAll('.month-day').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.month-day').forEach(d => d.classList.remove('month-day-selecionado'));
      el.classList.add('month-day-selecionado');
      abrirDetalhe(container, el.dataset.date, porDia[el.dataset.date] || []);
    });
  });
}

function abrirDetalhe(container, date, items) {
  const detail = container.querySelector('#month-detail');
  detail.classList.remove('hidden');
  detail.innerHTML = `
    <div class="month-detail-inner">
      <div class="month-detail-header">
        <span class="month-detail-data">${formatarDataCurta(date)}</span>
        <button class="month-detail-fechar" id="btn-fechar-detail" aria-label="Fechar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="month-detail-items">
        ${items.length > 0
          ? items.map(i => renderCard(i, { compact: true })).join('')
          : '<p class="empty-text">Nenhum item neste dia.</p>'
        }
      </div>
    </div>
  `;
  detail.querySelector('#btn-fechar-detail').addEventListener('click', () => {
    detail.classList.add('hidden');
    container.querySelectorAll('.month-day').forEach(d => d.classList.remove('month-day-selecionado'));
  });
}
