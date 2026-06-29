import { db } from '../db.js';
import { formatarDiaSemana, addDias, expandirRecorrencia } from '../dateUtils.js';
import { renderCard } from '../components/card.js';

export function render(container, state) {
  const { diaSelecionado } = state;

  const regular  = [...db.getByData(diaSelecionado), ...db.getByPrazo(diaSelecionado)];
  const virtuais = db.getRecorrentes().flatMap(i => expandirRecorrencia(i, diaSelecionado, diaSelecionado));
  const todos    = [...regular, ...virtuais];

  const comHora = todos
    .filter(i => i.horaInicio)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const semHora = todos.filter(i => !i.horaInicio);

  container.innerHTML = `
    <div class="day-view">
      <div class="view-header">
        <button class="btn-nav" id="btn-prev-day" aria-label="Dia anterior">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 class="view-titulo">${formatarDiaSemana(diaSelecionado)}</h1>
        <button class="btn-nav" id="btn-next-day" aria-label="Próximo dia">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="day-body">
        ${todos.length === 0 ? renderVazio() : ''}

        ${comHora.length > 0 ? `
          <div class="day-section">
            <div class="section-label">Com horário</div>
            <div class="day-timeline">
              ${comHora.map(item => `
                <div class="timeline-row">
                  <div class="timeline-hora">${item.horaInicio}</div>
                  <div class="timeline-card">${renderCard(item)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${semHora.length > 0 ? `
          <div class="day-section">
            <div class="section-label">Sem horário definido</div>
            <div class="day-cards">
              ${semHora.map(item => renderCard(item)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-prev-day').addEventListener('click', () => {
    state.diaSelecionado = addDias(state.diaSelecionado, -1);
    render(container, state);
  });

  document.getElementById('btn-next-day').addEventListener('click', () => {
    state.diaSelecionado = addDias(state.diaSelecionado, 1);
    render(container, state);
  });
}

function renderVazio() {
  return `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <p class="empty-titulo">Nenhuma tarefa para hoje.</p>
      <p class="empty-sub">Use o botão + para adicionar um item.</p>
    </div>
  `;
}
