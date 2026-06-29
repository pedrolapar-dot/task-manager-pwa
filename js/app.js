import { db } from './db.js';
import { hoje, getSemana } from './dateUtils.js';
import { initModal, openModal } from './components/modal.js';
import { renderCardMenu, renderMoverMenu, escapeHtml } from './components/card.js';
import * as dayView    from './views/dayView.js';
import * as weekView   from './views/weekView.js';
import * as monthView  from './views/monthView.js';
import * as kanbanView from './views/kanbanView.js';
import * as searchView from './views/searchView.js';

// ─── Estado de UI ─────────────────────────────────────────────────────────────
const state = {
  abaAtiva: 'dia',
  diaSelecionado: hoje(),
  semanaAtual: getSemana(),
  mesAtual: (() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() }; })(),
  filtrosKanban: { tipo: '', prioridade: '', tag: '', busca: '' },
  _colunaMobileAtiva: 'backlog',
  busca: '',
};

let _popupEl   = null;
let _buscaTimer = null;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  db.init();
  initModal(renderViewAtual);
  setupTabs();
  setupFAB();
  setupCardEvents();
  setupBackup();
  setupBusca();
  renderViewAtual();
  registrarSW();
});

// ─── Renderização central ─────────────────────────────────────────────────────
function renderViewAtual() {
  fecharPopup();

  const containers = {
    dia:    document.getElementById('view-dia'),
    semana: document.getElementById('view-semana'),
    mes:    document.getElementById('view-mes'),
    gestao: document.getElementById('view-gestao'),
    busca:  document.getElementById('view-busca'),
  };

  // Busca ativa → mostra só o painel de busca
  if (state.busca.trim().length >= 2) {
    Object.values(containers).forEach(c => c && c.classList.remove('active'));
    containers.busca.classList.add('active');
    searchView.render(containers.busca, state.busca);
    return;
  }

  // Volta à aba normal
  Object.values(containers).forEach(c => c && c.classList.remove('active'));
  containers[state.abaAtiva]?.classList.add('active');

  switch (state.abaAtiva) {
    case 'dia':
      dayView.render(containers.dia, state);
      break;
    case 'semana':
      weekView.render(containers.semana, state);
      break;
    case 'mes':
      monthView.render(containers.mes, state);
      break;
    case 'gestao':
      kanbanView.render(containers.gestao, state, {
        onStatusChange: (id, novoStatus) => {
          const item = db.getById(id);
          const doIt = () => {
            db.update(id, { status: novoStatus });
            renderViewAtual();
            toast('Status atualizado.');
          };
          if (item?.recorrente) {
            confirmar(
              `Mover toda a série recorrente "<strong>${escapeHtml(item.titulo)}</strong>" para <strong>${novoStatus.replace('_',' ')}</strong>? Isso afeta o item-pai e todas as ocorrências futuras.`,
              doIt
            );
          } else {
            doIt();
          }
        },
        onExport: exportar,
        onImport: () => document.getElementById('import-file-input').click(),
      });
      break;
  }
}

// ─── Abas ─────────────────────────────────────────────────────────────────────
function setupTabs() {
  function ativarAba(tab) {
    state.abaAtiva = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // Limpar busca ao trocar de aba
    limparBusca();
    renderViewAtual();
  }
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => ativarAba(btn.dataset.tab));
  });
}

// ─── FAB ──────────────────────────────────────────────────────────────────────
function setupFAB() {
  document.getElementById('fab').addEventListener('click', () => {
    const defaults = {};
    if (state.abaAtiva === 'dia') defaults.data = state.diaSelecionado;
    openModal(null, defaults);
  });
}

// ─── Busca ────────────────────────────────────────────────────────────────────
function setupBusca() {
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(_buscaTimer);
    _buscaTimer = setTimeout(() => {
      state.busca = input.value;
      clear.style.display = input.value ? '' : 'none';
      renderViewAtual();
    }, 250);
  });

  clear.addEventListener('click', () => {
    input.value = '';
    limparBusca();
  });
}

function limparBusca() {
  state.busca = '';
  const input = document.getElementById('search-input');
  const clear = document.getElementById('search-clear');
  if (input) input.value = '';
  if (clear) clear.style.display = 'none';
}

// ─── Eventos dos cards (delegação em #main-content para cards dentro das views)
function setupCardEvents() {
  const main = document.getElementById('main-content');

  // Clique em qualquer [data-action] DENTRO das views (não nos popups)
  main.addEventListener('click', (e) => {
    // Fechar popup ao clicar fora dele
    if (_popupEl && !_popupEl.contains(e.target)) fecharPopup();

    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    e.stopPropagation();
    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'menu') {
      const card      = btn.closest('.card');
      const ocorrencia = card ? (card.dataset.ocorrencia || null) : null;
      abrirMenuCard(btn, id, ocorrencia);
    }
  });

  // Clicar no card (fora de qualquer [data-action]) → abre edição
  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    const card = e.target.closest('.card');
    if (card && card.dataset.id) {
      const ocorrencia = card.dataset.ocorrencia || null;
      openModal(card.dataset.id, {}, { ocorrencia });
    }
  });
}

// ─── Menu de card (popup no body — precisa de listeners diretos) ───────────────
function abrirMenuCard(anchor, id, ocorrencia = null) {
  fecharPopup();
  const item = db.getById(id);
  if (!item) return;

  const div = document.createElement('div');
  div.innerHTML = renderCardMenu(id);
  const menu = div.firstElementChild;

  posicionarPopup(menu, anchor);
  _popupEl = menu;

  // Listeners diretos (popup fica no body, fora do #main-content)
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    fecharPopup();
    openModal(id, {}, { ocorrencia });
  });

  menu.querySelector('[data-action="mover"]').addEventListener('click', () => {
    fecharPopup();
    abrirMoverMenu(anchor, id);
  });

  menu.querySelector('[data-action="concluir"]').addEventListener('click', () => {
    fecharPopup();
    if (ocorrencia) {
      // Recorrente: marca só esta ocorrência como concluída
      const orig = db.getById(id);
      if (!orig) return;
      const concluidas = [...(orig.ocorrenciasConcluidas || [])];
      if (!concluidas.includes(ocorrencia)) concluidas.push(ocorrencia);
      db.update(id, { ocorrenciasConcluidas: concluidas });
      toast('Ocorrência concluída.');
    } else {
      db.update(id, { status: 'concluido' });
      toast('Item concluído.');
    }
    renderViewAtual();
  });

  menu.querySelector('[data-action="arquivar"]').addEventListener('click', () => {
    fecharPopup();
    db.update(id, { status: 'arquivado' });
    renderViewAtual();
    toast('Item arquivado.');
  });

  menu.querySelector('[data-action="excluir"]').addEventListener('click', () => {
    fecharPopup();
    if (ocorrencia) {
      // Recorrente: ignora só esta ocorrência
      confirmar('Remover apenas esta ocorrência da série recorrente?', () => {
        const orig = db.getById(id);
        if (!orig) return;
        const ignoradas = [...(orig.ocorrenciasIgnoradas || [])];
        if (!ignoradas.includes(ocorrencia)) ignoradas.push(ocorrencia);
        db.update(id, { ocorrenciasIgnoradas: ignoradas });
        renderViewAtual();
        toast('Ocorrência removida.');
      });
    } else {
      const msg = item.recorrente
        ? 'Isso vai excluir o item recorrente e TODAS as suas ocorrências futuras. Esta ação não pode ser desfeita.'
        : 'Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.';
      confirmar(msg, () => {
        db.delete(id);
        renderViewAtual();
        toast('Item excluído.');
      });
    }
  });
}

// ─── Menu "Mover para" ────────────────────────────────────────────────────────
function abrirMoverMenu(anchor, id) {
  fecharPopup();
  const item = db.getById(id);
  if (!item) return;

  const div = document.createElement('div');
  div.innerHTML = renderMoverMenu(id, item.status);
  const menu = div.firstElementChild;

  posicionarPopup(menu, anchor);
  _popupEl = menu;

  menu.querySelectorAll('[data-action="mover-para"]').forEach(b => {
    b.addEventListener('click', () => {
      db.update(id, { status: b.dataset.status });
      fecharPopup();
      renderViewAtual();
      toast('Item movido.');
    });
  });
}

// ─── Posicionamento de popup ──────────────────────────────────────────────────
function posicionarPopup(el, anchor) {
  el.style.position = 'fixed';
  el.style.zIndex   = '9999';
  document.body.appendChild(el);

  const rect   = anchor.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  let top  = rect.bottom + 4;
  let left = rect.right  - elRect.width;

  if (top + elRect.height > window.innerHeight - 16) top = rect.top - elRect.height - 4;
  if (left < 8) left = 8;

  el.style.top  = `${top}px`;
  el.style.left = `${left}px`;
}

function fecharPopup() {
  if (_popupEl) { _popupEl.remove(); _popupEl = null; }
}

// Fechar popup ao clicar em qualquer lugar do documento (fora do main)
document.addEventListener('click', (e) => {
  if (_popupEl && !_popupEl.contains(e.target)) fecharPopup();
}, true);

// ─── Backup ───────────────────────────────────────────────────────────────────
function setupBackup() {
  document.getElementById('btn-export').addEventListener('click', exportar);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });
  document.getElementById('import-file-input').addEventListener('change', importar);
}

function exportar() {
  const data = db.exportJSON();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `task-manager-backup-${hoje()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado com sucesso.');
}

function importar(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const reader = new FileReader();
  reader.onload = (ev) => {
    let json;
    try { json = JSON.parse(ev.target.result); }
    catch { toast('Arquivo inválido. Não foi possível ler o JSON.', 'erro'); return; }

    confirmar(
      `Isso vai substituir todos os seus dados atuais (${db.getAll().length} itens). Esta ação não pode ser desfeita. Continuar?`,
      () => {
        try {
          db.importJSON(json);
          renderViewAtual();
          toast(`Backup importado: ${json.items.length} itens restaurados.`);
        } catch (err) {
          toast(err.message, 'erro');
        }
      }
    );
  };
  reader.readAsText(file);
}

// ─── Utilitários de UI ────────────────────────────────────────────────────────
export function toast(msg, tipo = 'ok') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className  = `toast toast-${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.classList.add('toast-visivel'), 10);
  setTimeout(() => { el.classList.remove('toast-visivel'); setTimeout(() => el.remove(), 300); }, 3000);
}

function confirmar(msg, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirmar-overlay';
  overlay.innerHTML = `
    <div class="confirmar-box">
      <p class="confirmar-msg">${msg}</p>
      <div class="confirmar-actions">
        <button class="btn-sec"    id="btn-conf-cancelar">Cancelar</button>
        <button class="btn-danger" id="btn-conf-ok">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-conf-cancelar').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#btn-conf-ok').addEventListener('click', () => { overlay.remove(); onConfirm(); });
}

// ─── Service Worker ───────────────────────────────────────────────────────────
function registrarSW() {
  if ('serviceWorker' in navigator) {
    // Path relativo — funciona em localhost:8787/ e em /task-manager-pwa/ no GitHub Pages
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}
