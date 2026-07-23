import { db, onAfterSave } from './db.js';
import { hoje, getSemana } from './dateUtils.js';
import { initModal, openModal } from './components/modal.js';
import { initDetailModal, openDetailModal } from './components/detailModal.js';
import { renderCardMenu, renderMoverMenu, escapeHtml } from './components/card.js';
import * as dayView    from './views/dayView.js';
import * as weekView   from './views/weekView.js';
import * as monthView  from './views/monthView.js';
import * as kanbanView from './views/kanbanView.js';
import * as searchView from './views/searchView.js';
import { isDriveEnabled, initAuth, requestToken } from './googleAuth.js';
import { baixar, enviar, snapshotDiario } from './driveSync.js';
import { baixarAgendaICS } from './ics.js';

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
  initDetailModal(renderViewAtual);
  setupTabs();
  setupFAB();
  setupCardEvents();
  setupBackup();
  setupBusca();
  renderViewAtual();
  registrarSW();
  setupDrive();

  // Aba Dia (em "hoje"): re-renderiza a cada minuto para a linha do "agora"
  // e os destaques acompanharem o relógio
  setInterval(() => {
    const modalAberto = !document.getElementById('modal-overlay').classList.contains('hidden');
    if (state.abaAtiva === 'dia' && state.busca.trim().length < 2 &&
        state.diaSelecionado === hoje() && !modalAberto && !_popupEl) {
      renderViewAtual();
    }
  }, 60000);
});

// ─── Renderização central ─────────────────────────────────────────────────────
// Criação/edição só acontece na Gestão; fora dela os cards abrem em modo leitura
function podeEditar() {
  return state.abaAtiva === 'gestao' && state.busca.trim().length < 2;
}

function atualizarFAB() {
  document.getElementById('fab').classList.toggle('fab-hidden', !podeEditar());
}

function renderViewAtual() {
  fecharPopup();
  atualizarFAB();

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
        onExportICS: exportarAgendaICS,
        onArquivarConcluidos: () => {
          const concluidos = db.filter({ status: 'concluido' });
          if (concluidos.length === 0) return;
          confirmar(
            `Arquivar <strong>${concluidos.length}</strong> ${concluidos.length === 1 ? 'item concluído' : 'itens concluídos'}? Eles continuam na coluna Arquivado.`,
            () => {
              concluidos.forEach(i => db.update(i.id, { status: 'arquivado' }));
              renderViewAtual();
              toast(`${concluidos.length} ${concluidos.length === 1 ? 'item arquivado' : 'itens arquivados'}.`);
            }
          );
        },
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
    if (!podeEditar()) return;
    openModal(null, {});
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
    renderViewAtual();
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

    // Check rápido no card (fora da Gestão): conclui/reabre sem abrir nada
    if (action === 'quick-check') {
      const card       = btn.closest('.card');
      const ocorrencia = card ? (card.dataset.ocorrencia || null) : null;
      const item       = db.getById(id);
      if (!item) return;

      if (ocorrencia) {
        const concluidas = [...(item.ocorrenciasConcluidas || [])];
        const i = concluidas.indexOf(ocorrencia);
        if (i >= 0) { concluidas.splice(i, 1); toast('Ocorrência reaberta.'); }
        else        { concluidas.push(ocorrencia); toast('Ocorrência concluída.'); }
        db.update(id, { ocorrenciasConcluidas: concluidas });
      } else if (item.status === 'concluido') {
        db.update(id, { status: 'ativo' });
        toast('Item reaberto.');
      } else {
        db.update(id, { status: 'concluido' });
        toast('Item concluído.');
      }
      renderViewAtual();
    }
  });

  // Clicar no card (fora de qualquer [data-action]):
  // na Gestão → edição; nas demais views/busca → detalhes (somente leitura)
  main.addEventListener('click', (e) => {
    if (e.target.closest('[data-action]')) return;
    const card = e.target.closest('.card');
    if (card && card.dataset.id) {
      const ocorrencia = card.dataset.ocorrencia || null;
      if (podeEditar()) openModal(card.dataset.id, {}, { ocorrencia });
      else              openDetailModal(card.dataset.id, { ocorrencia });
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

  menu.querySelector('[data-action="duplicar"]').addEventListener('click', () => {
    fecharPopup();
    const orig = db.getById(id);
    if (!orig) return;
    const now = new Date().toISOString();
    const { id: _id, criadoEm, atualizadoEm, subtarefas, titulo, ...resto } = orig;
    const novo = db.create({
      ...resto,
      titulo: `${titulo} (cópia)`,
      subtarefas: (subtarefas || []).map(s => ({
        ...s, id: crypto.randomUUID(), concluida: false, criadoEm: now, atualizadoEm: now,
      })),
      subtarefasPorDia: {},
      ocorrenciasConcluidas: [],
      ocorrenciasIgnoradas: [],
    });
    renderViewAtual();
    toast('Item duplicado.');
    openModal(novo.id);
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
  document.getElementById('btn-ics')?.addEventListener('click', exportarAgendaICS);
}

function exportarAgendaICS() {
  const n = baixarAgendaICS(db.getAll());
  if (n === 0) toast('Nenhum item marcado para notificar. Ao editar um item na Gestão, ligue "Notificar".', 'erro');
  else toast(`${n} ${n === 1 ? 'evento exportado' : 'eventos exportados'} — abra o arquivo para adicionar ao calendário.`);
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

// ─── Google Drive Sync ────────────────────────────────────────────────────────

const _dr = {
  conectado:    false,  // tem token válido nesta sessão
  sincronizando: false,
  fileId:       localStorage.getItem('tmw_drive_file_id') || null,
  erro:         null,
};

let _syncTimer    = null;
let _suppressSync = false; // evita re-sync ao importar dados do Drive

function _deviceId() {
  let id = localStorage.getItem('tmw_device_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('tmw_device_id', id); }
  return id;
}

function _localUpdatedAt() {
  const items = db.getAll();
  if (!items.length) return null;
  return items.reduce((m, i) => (i.atualizadoEm > m ? i.atualizadoEm : m), '');
}

function _buildPayload() {
  return {
    schemaVersion: 1,
    updatedAt:     _localUpdatedAt() || new Date().toISOString(),
    deviceId:      _deviceId(),
    items:         db.getAll(),
  };
}

async function setupDrive() {
  if (!isDriveEnabled()) return;

  // Mostra UI
  document.getElementById('btn-drive').classList.add('drive-enabled');
  document.getElementById('drive-bar').classList.add('drive-enabled');

  // Conecta listeners antes mesmo do GIS carregar
  document.getElementById('btn-drive').addEventListener('click', () => {
    if (!_dr.conectado) conectarDrive(); else sincronizarDrive();
  });
  document.getElementById('btn-drive-mobile').addEventListener('click', () => {
    if (!_dr.conectado) conectarDrive(); else sincronizarDrive();
  });

  const ok = await initAuth();
  if (!ok) {
    _dr.erro = 'Falha ao carregar Google Auth';
    _atualizarDriveUI('erro');
    return;
  }

  const foiConectado = localStorage.getItem('tmw_drive_was_connected') === 'true';
  _atualizarDriveUI(foiConectado ? 'reconectar' : 'desconectado');

  // Hook para sync automático após qualquer save
  onAfterSave(() => {
    if (_dr.conectado && !_suppressSync) agendarSync();
  });
}

async function conectarDrive() {
  _atualizarDriveUI('conectando');
  try {
    await requestToken('');
    _dr.conectado = true;
    _dr.erro = null;
    localStorage.setItem('tmw_drive_was_connected', 'true');
    _atualizarDriveUI('conectado');
    toast('Google Drive conectado.');
    await sincronizarDrive();
  } catch (err) {
    _dr.conectado = false;
    _dr.erro = err.message;
    _atualizarDriveUI('erro');
    toast('Falha ao conectar ao Google Drive.', 'erro');
  }
}

function agendarSync() {
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(sincronizarDrive, 3000);
}

async function sincronizarDrive() {
  if (!_dr.conectado || _dr.sincronizando) return;
  _dr.sincronizando = true;
  _dr.erro = null;
  _atualizarDriveUI('sincronizando');

  try {
    const resultado  = await baixar();
    const localAt    = _localUpdatedAt();
    const syncTime   = localStorage.getItem('tmw_drive_sync_time') || null;

    if (!resultado) {
      // Sem arquivo no Drive → criar com dados locais
      const id = await enviar(_buildPayload());
      _guardarFileId(id);
      _guardarSyncTime();
      toast('Dados enviados ao Google Drive.');
    } else {
      const { payload: dp, fileId } = resultado;
      _guardarFileId(fileId);

      if (!syncTime) {
        // Primeira conexão com arquivo existente → pedir decisão ao usuário
        _dr.sincronizando = false;
        _atualizarDriveUI('conectado');
        _modalConflito(dp, localAt);
        return;
      }

      const driveNewer = (dp.updatedAt || '') > syncTime;
      const localNewer = localAt && localAt > syncTime;

      if (driveNewer && localNewer) {
        _dr.sincronizando = false;
        _atualizarDriveUI('conectado');
        _modalConflito(dp, localAt);
        return;
      }

      if (driveNewer) {
        _suppressSync = true;
        db.importJSON(dp);
        _suppressSync = false;
        renderViewAtual();
        _guardarSyncTime();
        toast('Dados atualizados do Google Drive.');
      } else if (localNewer) {
        await enviar(_buildPayload(), _dr.fileId);
        _guardarSyncTime();
        toast('Dados sincronizados com Google Drive.');
      } else {
        _guardarSyncTime();
      }
    }

    _dr.sincronizando = false;
    _atualizarDriveUI('sincronizado');

    // Cópia de segurança versionada (1x por dia, nunca atrapalha o sync)
    snapshotDiario(_buildPayload());
  } catch (err) {
    _dr.sincronizando = false;
    _dr.erro = err.message;
    _atualizarDriveUI('erro');
    toast('Falha na sincronização com o Drive.', 'erro');
  }
}

function _guardarFileId(id) {
  _dr.fileId = id;
  if (id) localStorage.setItem('tmw_drive_file_id', id);
}

function _guardarSyncTime() {
  localStorage.setItem('tmw_drive_sync_time', new Date().toISOString());
}

function _modalConflito(drivePayload, localAt) {
  const fmt = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '—';

  const overlay = document.createElement('div');
  overlay.className = 'confirmar-overlay';
  overlay.innerHTML = `
    <div class="confirmar-box">
      <p class="confirmar-msg" style="font-weight:700;margin-bottom:6px">Conflito de dados</p>
      <p class="confirmar-msg" style="font-size:.825rem;opacity:.8">Existem dados no Google Drive e dados locais. Qual versão usar?</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin:14px 0 4px">
        <button class="btn-pri" id="_conf-drive">
          Usar dados do Drive
          <small style="display:block;font-weight:400;opacity:.75">${drivePayload.items?.length ?? 0} itens · ${fmt(drivePayload.updatedAt)}</small>
        </button>
        <button class="btn-sec" id="_conf-local">
          Manter dados locais
          <small style="display:block;font-weight:400;opacity:.7">${db.getAll().length} itens · ${fmt(localAt)}</small>
        </button>
        <button class="btn-sec" id="_conf-cancel" style="opacity:.7">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#_conf-drive').addEventListener('click', async () => {
    overlay.remove();
    _suppressSync = true;
    db.importJSON(drivePayload);
    _suppressSync = false;
    renderViewAtual();
    _guardarSyncTime();
    _atualizarDriveUI('sincronizado');
    toast('Dados do Drive carregados.');
  });

  overlay.querySelector('#_conf-local').addEventListener('click', async () => {
    overlay.remove();
    _dr.sincronizando = true;
    _atualizarDriveUI('sincronizando');
    try {
      await enviar(_buildPayload(), _dr.fileId);
      _guardarSyncTime();
      _dr.sincronizando = false;
      _atualizarDriveUI('sincronizado');
      toast('Dados locais enviados ao Drive.');
    } catch (err) {
      _dr.sincronizando = false;
      _dr.erro = err.message;
      _atualizarDriveUI('erro');
      toast('Falha ao enviar dados ao Drive.', 'erro');
    }
  });

  overlay.querySelector('#_conf-cancel').addEventListener('click', () => {
    overlay.remove();
    _atualizarDriveUI('conectado');
  });
}

function _atualizarDriveUI(status) {
  const S = {
    desconectado:  { label: 'Conectar Drive',       mLabel: 'Conectar Google Drive',       cor: 'off',      dis: false, title: 'Conectar ao Google Drive'             },
    reconectar:    { label: 'Reconectar Drive',      mLabel: 'Reconectar Google Drive',     cor: 'off',      dis: false, title: 'Clique para reconectar'               },
    conectando:    { label: 'Conectando...',          mLabel: 'Conectando...',               cor: 'syncing',  dis: true,  title: 'Conectando...'                        },
    conectado:     { label: 'Drive conectado',       mLabel: 'Drive conectado',             cor: 'ok',       dis: false, title: 'Clique para sincronizar agora'         },
    sincronizando: { label: 'Sincronizando...',      mLabel: 'Sincronizando...',            cor: 'syncing',  dis: true,  title: 'Sincronizando...'                     },
    sincronizado:  { label: 'Drive sincronizado',    mLabel: 'Drive sincronizado',          cor: 'ok',       dis: false, title: 'Sincronizado · clique para forçar'     },
    erro:          { label: 'Erro no Drive',         mLabel: 'Erro no Drive',               cor: 'err',      dis: false, title: _dr.erro || 'Erro · clique para tentar' },
  };

  const s = S[status] || S.desconectado;

  const btn  = document.getElementById('btn-drive');
  const lbl  = document.getElementById('drive-label');
  const btnM = document.getElementById('btn-drive-mobile');
  const lblM = document.getElementById('drive-bar-label');

  if (btn && lbl) {
    btn.className = `drive-btn drive-enabled drive-btn--${s.cor}`;
    lbl.textContent = s.label;
    btn.title    = s.title;
    btn.disabled = s.dis;
  }
  if (btnM && lblM) {
    btnM.className = `drive-bar-btn drive-bar-btn--${s.cor}`;
    lblM.textContent = s.mLabel;
    btnM.disabled = s.dis;
  }
}

// ─── Service Worker ───────────────────────────────────────────────────────────
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;

  // Path relativo — funciona em localhost:8787/ e em /task-manager-pwa/ no GitHub Pages
  navigator.serviceWorker.register('./service-worker.js')
    .then((reg) => {
      // iOS costuma só "acordar" o app instalado em vez de recarregá-lo;
      // checar atualização a cada volta ao primeiro plano
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});

  // Quando um SW novo assume, recarrega uma vez para rodar a versão nova —
  // sem isso o app instalado fica na versão antiga até ser fechado de vez.
  // Guard de jaControlada: no primeiro acesso o claim() também dispara
  // controllerchange e não queremos recarregar aí.
  const jaControlada = !!navigator.serviceWorker.controller;
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!jaControlada || recarregando) return;
    const modalAberto = !document.getElementById('modal-overlay').classList.contains('hidden');
    if (modalAberto) return; // não interromper uma edição; a versão nova entra na próxima abertura
    recarregando = true;
    location.reload();
  });
}
