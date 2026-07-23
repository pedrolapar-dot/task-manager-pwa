import { db } from '../db.js';
import { ordenarKanban } from '../sortUtils.js';
import { renderCard, TIPO_LABEL, PRIO_LABEL, escapeHtml } from '../components/card.js';

const COLUNAS = [
  { id: 'backlog',      label: 'Backlog',       cor: '#6b7280' },
  { id: 'ativo',        label: 'Ativo',         cor: '#3b82f6' },
  { id: 'em_andamento', label: 'Em andamento',  cor: '#8b5cf6' },
  { id: 'aguardando',   label: 'Aguardando',    cor: '#f59e0b' },
  { id: 'pausado',      label: 'Pausado',       cor: '#64748b' },
  { id: 'concluido',    label: 'Concluído',     cor: '#10b981' },
  { id: 'cancelado',    label: 'Cancelado',     cor: '#ef4444' },
  { id: 'arquivado',    label: 'Arquivado',     cor: '#374151' },
];

const STATUS_LABEL = Object.fromEntries(COLUNAS.map(c => [c.id, c.label]));

export function render(container, state, callbacks = {}) {
  const { onStatusChange, onExport, onImport } = callbacks;
  const f = state.filtrosKanban;

  // Coleta todas as tags únicas dos itens
  const todasTags = [...new Set(db.getAll().flatMap(i => i.tags || []))].sort();

  let items = db.getAll();
  if (f.tipo)     items = items.filter(i => i.tipo === f.tipo);
  if (f.prioridade) items = items.filter(i => i.prioridade === f.prioridade);
  if (f.tag)      items = items.filter(i => (i.tags || []).includes(f.tag));
  if (f.busca)    items = items.filter(i =>
    i.titulo.toLowerCase().includes(f.busca.toLowerCase()) ||
    (i.descricao || '').toLowerCase().includes(f.busca.toLowerCase())
  );

  const filtroAtivo = !!(f.tipo || f.prioridade || f.tag || f.busca);

  const porStatus = {};
  COLUNAS.forEach(c => { porStatus[c.id] = []; });
  items.forEach(item => {
    if (porStatus[item.status] !== undefined) porStatus[item.status].push(item);
  });
  // Colunas ordenadas: data/horário mais próximos primeiro, sem data por último
  COLUNAS.forEach(c => { porStatus[c.id] = ordenarKanban(porStatus[c.id]); });

  const total = db.getAll().length;

  container.innerHTML = `
    <div class="kanban-view">

      <!-- Filtros + backup -->
      <div class="kanban-topbar">
        <div class="kanban-filters">
          <input type="text" class="filter-select filter-text" id="filter-busca"
            placeholder="Buscar no quadro..." value="${escapeHtml(f.busca || '')}">
          <select id="filter-tipo" class="filter-select">
            <option value="">Tipo</option>
            ${Object.entries(TIPO_LABEL).map(([k,v]) =>
              `<option value="${k}"${f.tipo === k ? ' selected' : ''}>${v}</option>`
            ).join('')}
          </select>
          <select id="filter-prio" class="filter-select">
            <option value="">Prioridade</option>
            ${Object.entries(PRIO_LABEL).map(([k,v]) =>
              `<option value="${k}"${f.prioridade === k ? ' selected' : ''}>${v}</option>`
            ).join('')}
          </select>
          ${todasTags.length > 0 ? `
          <select id="filter-tag" class="filter-select">
            <option value="">Tag</option>
            ${todasTags.map(t => `<option value="${escapeHtml(t)}"${f.tag === t ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
          ` : ''}
          ${filtroAtivo ? `<button class="btn-limpar-filtros" id="btn-limpar-filtros">Limpar</button>` : ''}
        </div>

        <div class="kanban-actions">
          <!-- Seletor de coluna mobile -->
          <div class="kanban-col-select-wrap">
            <select id="kanban-col-select" class="filter-select">
              ${COLUNAS.map(c =>
                `<option value="${c.id}">${c.label} (${porStatus[c.id].length})</option>`
              ).join('')}
            </select>
          </div>

          <!-- Backup: visível sempre; no desktop tb fica no top-nav -->
          <div class="kanban-backup-btns">
            <button class="btn-backup" id="kb-export" title="Exportar backup JSON">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Exportar</span>
            </button>
            <button class="btn-backup" id="kb-import" title="Importar backup JSON">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Importar</span>
            </button>
          </div>
        </div>
      </div>

      ${total === 0 ? `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/></svg>
          <p class="empty-titulo">Nenhum item cadastrado.</p>
          <p class="empty-sub">Use o botão + para criar o primeiro item.</p>
        </div>
      ` : `
        <div class="kanban-board" id="kanban-board">
          ${COLUNAS.map(col => {
            const colItems = porStatus[col.id];
            return `
              <div class="kanban-col${state._colunaMobileAtiva === col.id ? ' kanban-col-mobile-ativa' : ''}"
                   data-status="${col.id}" id="kcol-${col.id}">
                <div class="kanban-col-header" style="--col-cor: ${col.cor}">
                  <div class="kanban-col-title-row">
                    <span class="kanban-col-dot"></span>
                    <span class="kanban-col-titulo">${col.label}</span>
                  </div>
                  <span class="kanban-col-count">${colItems.length}</span>
                </div>
                <div class="kanban-col-items" data-status="${col.id}">
                  ${colItems.length > 0
                    ? colItems.map(i => renderCard(i)).join('')
                    : '<div class="kanban-col-vazio"></div>'
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ${filtroAtivo && items.length === 0 ? `
          <div class="empty-state" style="padding: 40px 24px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <p class="empty-titulo">Nenhum resultado para os filtros aplicados.</p>
            <button class="btn-sec" id="btn-limpar-filtros-empty">Limpar filtros</button>
          </div>
        ` : ''}
      `}
    </div>
  `;

  // ── Filtros ──
  const filterBusca = document.getElementById('filter-busca');
  const filterTipo  = document.getElementById('filter-tipo');
  const filterPrio  = document.getElementById('filter-prio');
  const filterTag   = document.getElementById('filter-tag');
  const btnLimpar   = document.getElementById('btn-limpar-filtros');
  const btnLimparE  = document.getElementById('btn-limpar-filtros-empty');

  let buscaTimer = null;
  if (filterBusca) filterBusca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { state.filtrosKanban.busca = filterBusca.value; render(container, state, callbacks); }, 200);
  });
  if (filterTipo) filterTipo.addEventListener('change', () => { state.filtrosKanban.tipo = filterTipo.value; render(container, state, callbacks); });
  if (filterPrio) filterPrio.addEventListener('change', () => { state.filtrosKanban.prioridade = filterPrio.value; render(container, state, callbacks); });
  if (filterTag)  filterTag.addEventListener('change',  () => { state.filtrosKanban.tag = filterTag.value; render(container, state, callbacks); });

  const limpar = () => {
    state.filtrosKanban = { tipo: '', prioridade: '', tag: '', busca: '' };
    render(container, state, callbacks);
  };
  if (btnLimpar)  btnLimpar.addEventListener('click', limpar);
  if (btnLimparE) btnLimparE.addEventListener('click', limpar);

  // ── Seletor de coluna mobile ──
  const colSelect = document.getElementById('kanban-col-select');
  if (colSelect) {
    if (!state._colunaMobileAtiva) state._colunaMobileAtiva = 'backlog';
    atualizarColunasMobile(container, state._colunaMobileAtiva);
    colSelect.value = state._colunaMobileAtiva;
    colSelect.addEventListener('change', () => {
      state._colunaMobileAtiva = colSelect.value;
      atualizarColunasMobile(container, colSelect.value);
    });
  }

  // ── Backup ──
  const kbExport = document.getElementById('kb-export');
  const kbImport = document.getElementById('kb-import');
  if (kbExport && onExport) kbExport.addEventListener('click', onExport);
  if (kbImport && onImport) kbImport.addEventListener('click', onImport);

  // ── Drag & drop desktop ──
  if (onStatusChange) setupDragDrop(container, onStatusChange);
}

function atualizarColunasMobile(container, statusAtivo) {
  container.querySelectorAll('.kanban-col').forEach(col => {
    col.classList.toggle('kanban-col-mobile-ativa', col.dataset.status === statusAtivo);
  });
}

function setupDragDrop(container, onStatusChange) {
  container.querySelectorAll('.card').forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  container.querySelectorAll('.kanban-col-items').forEach(zone => {
    zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const novoStatus = zone.dataset.status;
      if (id && novoStatus) onStatusChange(id, novoStatus);
    });
  });
}
