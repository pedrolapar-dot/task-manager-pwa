import { formatarDataCurta, getDiaSemanaShort, hoje } from '../dateUtils.js';

export const TIPO_LABEL = {
  tarefa: 'Tarefa', projeto: 'Projeto', reuniao: 'Reunião', entrega: 'Entrega',
  feriado: 'Feriado', evento: 'Evento', lembrete: 'Lembrete',
};

export const PRIO_LABEL = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente',
};

export const STATUS_LABEL = {
  backlog: 'Backlog', ativo: 'Ativo', em_andamento: 'Em andamento',
  aguardando: 'Aguardando', pausado: 'Pausado', concluido: 'Concluído',
  cancelado: 'Cancelado', arquivado: 'Arquivado',
};

// Em itens recorrentes as subtarefas são marcadas por dia (ocorrência).
// Retorna null para o item-pai recorrente (sem dia definido → só mostra o total).
export function contarSubFeitas(item) {
  const subs = item.subtarefas || [];
  if (item.recorrente) {
    const dia = item._dataOcorrencia;
    if (!dia) return null;
    const feitas = (item.subtarefasPorDia || {})[dia] || [];
    return subs.filter(s => feitas.includes(s.id)).length;
  }
  return subs.filter(s => s.concluida).length;
}

export function renderCard(item, { showMenu = true, compact = false } = {}) {
  const hj = hoje();
  const prazoVencido = item.prazo && item.prazo < hj && !['concluido','cancelado','arquivado'].includes(item.status);
  const prazoHoje    = item.prazo && item.prazo === hj;

  const subtarefas = item.subtarefas || [];
  const subTotal   = subtarefas.length;
  const subFeitas  = contarSubFeitas(item);

  const ocorrenciaAttr = item._virtual ? `data-ocorrencia="${item._dataOcorrencia}"` : '';

  return `
    <div class="card${compact ? ' card-compact' : ''}${item.status === 'concluido' ? ' card-concluido' : ''}"
         data-id="${item.id}" data-prio="${item.prioridade}" ${ocorrenciaAttr}>
      <div class="card-top">
        <div class="card-badges">
          <span class="badge tipo-${item.tipo}">${TIPO_LABEL[item.tipo] || item.tipo}</span>
          <span class="badge prio-${item.prioridade}">${PRIO_LABEL[item.prioridade] || item.prioridade}</span>
          ${item.recorrente ? `<span class="badge badge-recorrente" title="Recorrente">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </span>` : ''}
        </div>
        ${showMenu ? `
          <button class="card-menu-btn" data-action="menu" data-id="${item.id}" aria-label="Opções">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        ` : `
          <button class="card-check${item.status === 'concluido' ? ' card-check-feito' : ''}"
                  data-action="quick-check" data-id="${item.id}"
                  aria-label="${item.status === 'concluido' ? 'Reabrir' : 'Concluir'}"
                  title="${item.status === 'concluido' ? 'Concluído · toque para reabrir' : 'Concluir'}">
            ${item.status === 'concluido'
              ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
              : ''}
          </button>
        `}
      </div>

      <div class="card-titulo${item.status === 'concluido' ? ' riscado' : ''}">${escapeHtml(item.titulo)}</div>

      ${item.horaInicio ? `
        <div class="card-hora">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${item.horaInicio}${item.horaFim ? ' – ' + item.horaFim : ''}
        </div>
      ` : ''}

      ${item._proxOcorrencia ? `
        <div class="card-hora card-prox">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Próx: ${getDiaSemanaShort(item._proxOcorrencia)} ${formatarDataCurta(item._proxOcorrencia)}
        </div>
      ` : ''}

      ${subTotal > 0 || item.prazo || item.tags.length > 0 || item.descricao ? `
        <div class="card-footer">
          ${subTotal > 0 ? `<span class="card-sub-progress${subFeitas === subTotal ? ' sub-completo' : ''}" title="Subtarefas">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            ${subFeitas === null ? subTotal : `${subFeitas}/${subTotal}`}
          </span>` : ''}
          ${item.prazo ? `
            <span class="card-prazo${prazoVencido ? ' prazo-vencido' : ''}${prazoHoje ? ' prazo-hoje' : ''}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${formatarDataCurta(item.prazo)}
            </span>
          ` : ''}
          ${item.descricao ? `
            <span class="card-desc-ind" title="Tem descrição">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
            </span>
          ` : ''}
          ${item.tags.length > 0 ? `
            <div class="card-tags">
              ${item.tags.slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderCardMenu(id) {
  return `
    <div class="card-menu" id="card-menu-${id}">
      <button class="menu-item" data-action="edit" data-id="${id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar
      </button>
      <button class="menu-item" data-action="mover" data-id="${id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        Mover para...
      </button>
      <button class="menu-item" data-action="duplicar" data-id="${id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Duplicar
      </button>
      <button class="menu-item" data-action="concluir" data-id="${id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Concluir
      </button>
      <button class="menu-item" data-action="arquivar" data-id="${id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
        Arquivar
      </button>
      <button class="menu-item menu-item-danger" data-action="excluir" data-id="${id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        Excluir
      </button>
    </div>
  `;
}

export function renderMoverMenu(id, statusAtual) {
  const colunas = [
    { value: 'backlog',      label: 'Backlog' },
    { value: 'ativo',        label: 'Ativo' },
    { value: 'em_andamento', label: 'Em andamento' },
    { value: 'aguardando',   label: 'Aguardando' },
    { value: 'pausado',      label: 'Pausado' },
    { value: 'concluido',    label: 'Concluído' },
    { value: 'cancelado',    label: 'Cancelado' },
    { value: 'arquivado',    label: 'Arquivado' },
  ];
  return `
    <div class="mover-menu" id="mover-menu-${id}">
      <div class="mover-menu-header">Mover para...</div>
      ${colunas.map(c => `
        <button class="mover-btn${c.value === statusAtual ? ' mover-btn-atual' : ''}"
                data-action="mover-para" data-id="${id}" data-status="${c.value}">
          ${c.label}
          ${c.value === statusAtual ? '<span class="mover-atual-mark">atual</span>' : ''}
        </button>
      `).join('')}
    </div>
  `;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
