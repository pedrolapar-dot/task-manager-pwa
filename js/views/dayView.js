import { db } from '../db.js';
import { formatarDiaSemana, formatarDataCurta, addDias, hoje, expandirRecorrencia } from '../dateUtils.js';
import { ordenarPorHorario } from '../sortUtils.js';
import { renderCard } from '../components/card.js';

function somarMinutos(hm, n) {
  const [h, m] = hm.split(':').map(Number);
  const t = h * 60 + m + n;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function render(container, state) {
  const { diaSelecionado } = state;

  const regular  = [...db.getByData(diaSelecionado), ...db.getByPrazo(diaSelecionado)];
  const virtuais = db.getRecorrentes().flatMap(i => expandirRecorrencia(i, diaSelecionado, diaSelecionado));
  const todos    = ordenarPorHorario([...regular, ...virtuais]);

  const comHora = todos.filter(i => i.horaInicio);
  const semHora = todos.filter(i => !i.horaInicio);

  const concluidos = todos.filter(i => i.status === 'concluido').length;
  const resumo = todos.length > 0
    ? `${todos.length} ${todos.length === 1 ? 'item' : 'itens'}${concluidos > 0 ? ` · ${concluidos} concluído${concluidos !== 1 ? 's' : ''}` : ''}`
    : '';

  const ehHoje = diaSelecionado === hoje();

  // Só na visão de hoje: itens de dias anteriores ainda em aberto
  const atrasadas = ehHoje ? db.getAtrasadas(diaSelecionado) : [];

  // Linha do "agora" + destaques (só em hoje)
  const agora = ehHoje
    ? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    : null;
  const fimDe = (i) => i.horaFim || somarMinutos(i.horaInicio, 60);
  let idxAtual = -1, idxProxima = -1;
  if (agora) {
    comHora.forEach((i, idx) => {
      if (i.status !== 'concluido' && i.horaInicio <= agora && agora < fimDe(i)) idxAtual = idx;
      if (idxProxima === -1 && i.horaInicio > agora) idxProxima = idx;
    });
  }

  const nowLine = `
    <div class="now-line">
      <span class="now-line-hora">${agora}</span>
      <span class="now-line-traco"></span>
    </div>
  `;

  let timelineRows = '';
  let linhaInserida = false;
  comHora.forEach((item, idx) => {
    if (agora && !linhaInserida && item.horaInicio > agora) {
      timelineRows += nowLine;
      linhaInserida = true;
    }
    timelineRows += `
      <div class="timeline-row${idx === idxAtual ? ' timeline-row-atual' : ''}">
        <div class="timeline-hora">
          ${item.horaInicio}
          ${idx === idxAtual ? '<span class="chip-agora">agora</span>' : ''}
          ${idx === idxProxima ? '<span class="chip-proxima">a seguir</span>' : ''}
        </div>
        <div class="timeline-card">${renderCard(item, { showMenu: false })}</div>
      </div>
    `;
  });
  if (agora && !linhaInserida && comHora.length > 0) timelineRows += nowLine;

  container.innerHTML = `
    <div class="day-view">
      <div class="view-header">
        <button class="btn-nav" id="btn-prev-day" aria-label="Dia anterior">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="view-titulo-wrap">
          <h1 class="view-titulo">${formatarDiaSemana(diaSelecionado)}</h1>
          ${resumo ? `<div class="view-subtitulo">${resumo}</div>` : ''}
        </div>
        <button class="btn-nav" id="btn-next-day" aria-label="Próximo dia">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      ${!ehHoje ? `
        <div class="hoje-wrap">
          <button class="btn-hoje" id="btn-voltar-hoje">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
            Voltar para hoje
          </button>
        </div>
      ` : ''}

      <div class="day-body">
        ${atrasadas.length > 0 ? `
          <div class="day-section">
            <div class="section-label section-label-atrasadas">Atrasadas (${atrasadas.length})</div>
            <div class="day-timeline">
              ${atrasadas.map(item => `
                <div class="timeline-row">
                  <div class="timeline-hora hora-atrasada">${formatarDataCurta(item.data || item.prazo)}</div>
                  <div class="timeline-card">${renderCard(item, { showMenu: false })}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${todos.length === 0 && atrasadas.length === 0 ? renderVazio() : ''}

        ${comHora.length > 0 ? `
          <div class="day-section">
            <div class="section-label">Com horário</div>
            <div class="day-timeline">${timelineRows}</div>
          </div>
        ` : ''}

        ${semHora.length > 0 ? `
          <div class="day-section">
            <div class="section-label">Sem horário definido</div>
            <div class="day-cards">
              ${semHora.map(item => renderCard(item, { showMenu: false })).join('')}
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

  const btnHoje = document.getElementById('btn-voltar-hoje');
  if (btnHoje) btnHoje.addEventListener('click', () => {
    state.diaSelecionado = hoje();
    render(container, state);
  });
}

function renderVazio() {
  return `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <p class="empty-titulo">Nenhuma tarefa para este dia.</p>
      <p class="empty-sub">Crie e organize seus itens na aba Gestão.</p>
    </div>
  `;
}
