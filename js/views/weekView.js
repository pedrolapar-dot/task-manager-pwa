import { db } from '../db.js';
import { getSemana, addDias, formatarDataCurta, semanaLabel, isHoje, expandirRecorrencia } from '../dateUtils.js';
import { renderCard } from '../components/card.js';

const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function render(container, state) {
  const { inicio, fim } = state.semanaAtual;

  const dias = [];
  for (let i = 0; i < 7; i++) dias.push(addDias(inicio, i));

  // Itens regulares
  const regular  = db.getBySemana(inicio, fim);
  // Ocorrências virtuais de recorrentes
  const virtuais = db.getRecorrentes().flatMap(i => expandirRecorrencia(i, inicio, fim));
  const todos    = [...regular, ...virtuais];

  // Agrupa por data
  const porDia = {};
  dias.forEach(d => { porDia[d] = []; });
  todos.forEach(item => {
    const key = item.data;
    if (key && porDia[key] !== undefined) {
      porDia[key].push(item);
    } else if (!item.data && item.prazo && porDia[item.prazo] !== undefined) {
      porDia[item.prazo].push(item);
    }
  });

  container.innerHTML = `
    <div class="week-view">
      <div class="view-header">
        <button class="btn-nav" id="btn-prev-week" aria-label="Semana anterior">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 class="view-titulo">${semanaLabel(inicio, fim)}</h1>
        <button class="btn-nav" id="btn-next-week" aria-label="Próxima semana">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="week-grid">
        ${dias.map((date, i) => {
          const dayItems = porDia[date] || [];
          const ehHoje = isHoje(date);
          return `
            <div class="week-day${ehHoje ? ' week-day-hoje' : ''}">
              <div class="week-day-header">
                <span class="week-dia-nome">${DIAS_CURTOS[i]}</span>
                <span class="week-dia-num${ehHoje ? ' hoje-num' : ''}">${formatarDataCurta(date).split('/')[0]}</span>
              </div>
              <div class="week-day-body">
                ${dayItems.length > 0
                  ? dayItems.map(item => renderCard(item, { compact: true })).join('')
                  : '<div class="week-day-vazio"></div>'
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  document.getElementById('btn-prev-week').addEventListener('click', () => {
    state.semanaAtual = getSemana(addDias(inicio, -7));
    render(container, state);
  });

  document.getElementById('btn-next-week').addEventListener('click', () => {
    state.semanaAtual = getSemana(addDias(inicio, 7));
    render(container, state);
  });
}
