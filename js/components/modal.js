import { db } from '../db.js';
import { escapeHtml } from './card.js';

let _onSave = null;
let _subtarefas = [];

export function initModal(onSaveCb) {
  _onSave = onSaveCb;
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

export function openModal(itemId = null, defaults = {}, { ocorrencia = null } = {}) {
  const item = itemId ? db.getById(itemId) : null;
  _subtarefas = item ? [...(item.subtarefas || [])] : [];

  const overlay = document.getElementById('modal-overlay');
  const modal   = document.getElementById('modal');
  modal.innerHTML = renderForm(item, defaults, { ocorrencia });
  overlay.classList.remove('hidden');

  document.getElementById('input-titulo').focus();

  document.getElementById('form-item').addEventListener('submit', (e) => {
    e.preventDefault();
    salvar(itemId);
  });

  document.getElementById('btn-modal-fechar').addEventListener('click', closeModal);
  document.getElementById('btn-modal-cancelar').addEventListener('click', closeModal);

  // Tipo → toggle campos de hora
  const tipoSel = document.getElementById('input-tipo');
  tipoSel.addEventListener('change', () => toggleHoras(tipoSel.value));
  toggleHoras(tipoSel.value);

  // Recorrência toggle (também re-renderiza subtarefas: recorrente não tem checkbox)
  const recCheck = document.getElementById('input-recorrente');
  recCheck.addEventListener('change', () => {
    toggleRecorrencia(recCheck.checked);
    renderSubtarefas();
  });
  toggleRecorrencia(recCheck.checked);

  // Frequência → campos condicionais
  document.getElementById('input-rec-frequencia').addEventListener('change', () => {
    toggleCamposFrequencia(document.getElementById('input-rec-frequencia').value);
  });
  toggleCamposFrequencia(document.getElementById('input-rec-frequencia').value);

  // Subtarefas
  renderSubtarefas();
  setupSubtarefas();
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal').innerHTML = '';
  _subtarefas = [];
}

// ─── Salvar ──────────────────────────────────────────────────────────────────

function salvar(itemId) {
  const dados = lerFormulario();
  if (!dados.titulo.trim()) {
    document.getElementById('input-titulo').classList.add('input-erro');
    document.getElementById('input-titulo').focus();
    return;
  }
  if (itemId) db.update(itemId, dados);
  else         db.create(dados);
  closeModal();
  if (_onSave) _onSave();
}

function lerFormulario() {
  const get = (id) => document.getElementById(id);
  const tagsRaw = get('input-tags').value.trim();
  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

  const recorrente = get('input-recorrente').checked;
  let recorrencia = null;
  if (recorrente) {
    const freq = get('input-rec-frequencia').value;
    const intervalo = parseInt(get('input-rec-intervalo').value) || 1;
    const dataFim = get('input-rec-data-fim').value || null;
    let diasSemana = [];
    if (freq === 'semanal') {
      document.querySelectorAll('input[name="rec-dia"]:checked').forEach(cb => diasSemana.push(cb.value));
    }
    const diaMes = freq === 'mensal' ? (parseInt(get('input-rec-dia-mes').value) || null) : null;
    recorrencia = { frequencia: freq, intervalo, diasSemana, diaMes, dataFim };
  }

  return {
    titulo:      get('input-titulo').value.trim(),
    tipo:        get('input-tipo').value,
    descricao:   get('input-descricao').value.trim(),
    data:        get('input-data').value || null,
    horaInicio:  get('input-hora-inicio').value || null,
    horaFim:     get('input-hora-fim').value || null,
    prazo:       get('input-prazo').value || null,
    prioridade:  get('input-prioridade').value,
    status:      get('input-status').value,
    tags,
    subtarefas:  [..._subtarefas],
    recorrente,
    recorrencia,
  };
}

// ─── Subtarefas ──────────────────────────────────────────────────────────────

function renderSubtarefas() {
  const list = document.getElementById('subtarefas-list');
  if (!list) return;

  // Item recorrente: aqui se edita só a ESTRUTURA do checklist —
  // marcar/desmarcar é por dia, na visualização do item (fora da Gestão)
  const ehRecorrente = !!document.getElementById('input-recorrente')?.checked;

  if (_subtarefas.length === 0) {
    list.innerHTML = '<p class="subtarefa-vazia">Nenhuma subtarefa ainda.</p>';
  } else {
    list.innerHTML = _subtarefas.map((s, i) => `
      <div class="subtarefa-item">
        ${ehRecorrente
          ? '<span class="subtarefa-bullet"></span>'
          : `<input type="checkbox" class="subtarefa-check" id="sub-${i}" data-idx="${i}" ${s.concluida ? 'checked' : ''}>`}
        <label ${ehRecorrente ? '' : `for="sub-${i}"`} class="subtarefa-label${!ehRecorrente && s.concluida ? ' riscado' : ''}">${escapeHtml(s.titulo)}</label>
        <span class="sub-move">
          <button type="button" class="btn-sub-move" data-move="-1" data-idx="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Mover para cima">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button type="button" class="btn-sub-move" data-move="1" data-idx="${i}" ${i === _subtarefas.length - 1 ? 'disabled' : ''} aria-label="Mover para baixo">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </span>
        <button type="button" class="btn-sub-del" data-idx="${i}" aria-label="Remover subtarefa">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('') + (ehRecorrente
      ? '<p class="subtarefa-hint-rec">Item repetido: as subtarefas são marcadas por dia, abrindo o item na aba Dia, Semana ou Mês.</p>'
      : '');
  }

  list.querySelectorAll('.subtarefa-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const i = parseInt(cb.dataset.idx);
      _subtarefas[i].concluida     = cb.checked;
      _subtarefas[i].atualizadoEm  = new Date().toISOString();
      renderSubtarefas();
    });
  });

  list.querySelectorAll('.btn-sub-del').forEach(btn => {
    btn.addEventListener('click', () => {
      _subtarefas.splice(parseInt(btn.dataset.idx), 1);
      renderSubtarefas();
    });
  });

  list.querySelectorAll('.btn-sub-move').forEach(btn => {
    btn.addEventListener('click', () => {
      const i   = parseInt(btn.dataset.idx);
      const dir = parseInt(btn.dataset.move);
      const j   = i + dir;
      if (j < 0 || j >= _subtarefas.length) return;
      [_subtarefas[i], _subtarefas[j]] = [_subtarefas[j], _subtarefas[i]];
      renderSubtarefas();
    });
  });
}

function setupSubtarefas() {
  const input = document.getElementById('input-nova-subtarefa');
  const btn   = document.getElementById('btn-add-subtarefa');
  if (!input || !btn) return;

  const adicionar = () => {
    const titulo = input.value.trim();
    if (!titulo) return;
    const now = new Date().toISOString();
    _subtarefas.push({ id: crypto.randomUUID(), titulo, concluida: false, criadoEm: now, atualizadoEm: now });
    input.value = '';
    renderSubtarefas();
    input.focus();
  };

  btn.addEventListener('click', adicionar);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
}

// ─── Toggles ─────────────────────────────────────────────────────────────────

function toggleHoras(tipo) {
  const g = document.getElementById('grupo-hora');
  if (g) g.style.display = tipo === 'feriado' ? 'none' : '';
}

function toggleRecorrencia(ativo) {
  const c = document.getElementById('rec-campos');
  if (c) c.style.display = ativo ? 'flex' : 'none';
}

function toggleCamposFrequencia(freq) {
  const s = document.getElementById('rec-dias-semana');
  const m = document.getElementById('rec-dia-mes');
  if (s) s.style.display = freq === 'semanal' ? '' : 'none';
  if (m) m.style.display = freq === 'mensal'  ? '' : 'none';
}

// ─── HTML do formulário ───────────────────────────────────────────────────────

function opt(values, selected, labels) {
  return values.map(v =>
    `<option value="${v}"${v === selected ? ' selected' : ''}>${labels[v] || v}</option>`
  ).join('');
}

function val(item, field, def = '') {
  if (!item) return def;
  const v = item[field];
  return v !== undefined && v !== null ? v : def;
}

function renderForm(item, defaults = {}, { ocorrencia = null } = {}) {
  const titulo    = item ? val(item, 'titulo') : (defaults.titulo || '');
  const tipo      = item ? val(item, 'tipo', 'tarefa')   : (defaults.tipo || 'tarefa');
  const prio      = item ? val(item, 'prioridade', 'media') : (defaults.prioridade || 'media');
  const status    = item ? val(item, 'status', 'backlog')   : (defaults.status || 'backlog');
  const data      = item ? val(item, 'data') : (defaults.data || '');
  const prazo     = item ? val(item, 'prazo') : '';
  const horaI     = item ? val(item, 'horaInicio') : '';
  const horaF     = item ? val(item, 'horaFim') : '';
  const descricao = item ? val(item, 'descricao') : '';
  const tags      = item ? val(item, 'tags', []).join(', ') : '';
  const rec       = item ? val(item, 'recorrente', false) : false;
  const recObj    = item ? val(item, 'recorrencia', null) : null;

  const DIAS_CURTOS_LABEL = { seg:'Seg', ter:'Ter', qua:'Qua', qui:'Qui', sex:'Sex', sab:'Sáb', dom:'Dom' };

  const isVirtual = !!ocorrencia;

  return `
    <div class="modal-inner">
      <div class="modal-header">
        <h2 class="modal-titulo">${item ? 'Editar item' : 'Novo item'}</h2>
        <button class="modal-close-btn" id="btn-modal-fechar" type="button" aria-label="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      ${item?.recorrente ? `
        <div class="modal-banner-rec">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          ${isVirtual
            ? `Editando a <strong>série recorrente</strong> — todas as ocorrências serão afetadas.`
            : `Você está editando a <strong>série recorrente</strong>.`}
        </div>
      ` : ''}

      <form id="form-item" class="modal-form" novalidate>

        <div class="form-group">
          <label for="input-titulo">Título <span class="required">*</span></label>
          <input id="input-titulo" type="text" value="${escapeHtml(titulo)}" placeholder="O que precisa ser feito?" autocomplete="off">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="input-tipo">Tipo</label>
            <select id="input-tipo">
              ${opt(['tarefa','projeto','reuniao','entrega','feriado','evento','lembrete'], tipo,
                {tarefa:'Tarefa',projeto:'Projeto',reuniao:'Reunião',entrega:'Entrega',feriado:'Feriado',evento:'Evento',lembrete:'Lembrete'})}
            </select>
          </div>
          <div class="form-group">
            <label for="input-prioridade">Prioridade</label>
            <select id="input-prioridade">
              ${opt(['baixa','media','alta','urgente'], prio, {baixa:'Baixa',media:'Média',alta:'Alta',urgente:'Urgente'})}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="input-data">Data</label>
            <input id="input-data" type="date" value="${data}">
          </div>
          <div class="form-group">
            <label for="input-prazo">Prazo</label>
            <input id="input-prazo" type="date" value="${prazo}">
          </div>
        </div>

        <div id="grupo-hora" class="form-row">
          <div class="form-group">
            <label for="input-hora-inicio">Início</label>
            <input id="input-hora-inicio" type="time" value="${horaI}">
          </div>
          <div class="form-group">
            <label for="input-hora-fim">Fim</label>
            <input id="input-hora-fim" type="time" value="${horaF}">
          </div>
        </div>

        <div class="form-group">
          <label for="input-status">Status</label>
          <select id="input-status">
            ${opt(['backlog','ativo','em_andamento','aguardando','pausado','concluido','cancelado','arquivado'], status,
              {backlog:'Backlog',ativo:'Ativo',em_andamento:'Em andamento',aguardando:'Aguardando',
               pausado:'Pausado',concluido:'Concluído',cancelado:'Cancelado',arquivado:'Arquivado'})}
          </select>
        </div>

        <div class="form-group">
          <label for="input-tags">Tags</label>
          <input id="input-tags" type="text" value="${escapeHtml(tags)}" placeholder="trabalho, pessoal, urgente">
          <small class="form-hint">Separadas por vírgula</small>
        </div>

        <div class="form-group">
          <label for="input-descricao">Descrição</label>
          <textarea id="input-descricao" rows="2" placeholder="Detalhes opcionais...">${escapeHtml(descricao)}</textarea>
        </div>

        <!-- Subtarefas -->
        <div class="form-section">
          <div class="form-section-label">Subtarefas</div>
          <div id="subtarefas-list" class="subtarefas-list"></div>
          <div class="subtarefa-add-row">
            <input type="text" id="input-nova-subtarefa" placeholder="Adicionar subtarefa..." autocomplete="off">
            <button type="button" class="btn-sub-add" id="btn-add-subtarefa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>

        <!-- Recorrência -->
        <div class="form-section">
          <div class="form-check form-section-toggle">
            <input type="checkbox" id="input-recorrente" ${rec ? 'checked' : ''}>
            <label for="input-recorrente" class="form-section-label" style="cursor:pointer">Repetir</label>
          </div>

          <div id="rec-campos" style="display:${rec ? 'flex' : 'none'}; flex-direction:column; gap:12px; margin-top:4px;">
            <div class="form-row">
              <div class="form-group">
                <label for="input-rec-frequencia">Frequência</label>
                <select id="input-rec-frequencia">
                  ${opt(['diaria','semanal','mensal'], recObj?.frequencia || 'diaria',
                    {diaria:'Diária',semanal:'Semanal',mensal:'Mensal'})}
                </select>
              </div>
              <div class="form-group">
                <label for="input-rec-intervalo">A cada</label>
                <input id="input-rec-intervalo" type="number" min="1" max="30" value="${recObj?.intervalo || 1}">
              </div>
            </div>

            <div id="rec-dias-semana">
              <label class="form-label-sm">Dias da semana</label>
              <div class="dias-semana-picker">
                ${['seg','ter','qua','qui','sex','sab','dom'].map(d => `
                  <label class="dia-pill">
                    <input type="checkbox" name="rec-dia" value="${d}"
                           ${recObj?.diasSemana?.includes(d) ? 'checked' : ''}>
                    <span>${DIAS_CURTOS_LABEL[d]}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div id="rec-dia-mes">
              <div class="form-group">
                <label for="input-rec-dia-mes">Dia do mês</label>
                <input id="input-rec-dia-mes" type="number" min="1" max="31" value="${recObj?.diaMes || ''}" placeholder="Ex: 15">
              </div>
            </div>

            <div class="form-group">
              <label for="input-rec-data-fim">Data de fim (opcional)</label>
              <input id="input-rec-data-fim" type="date" value="${recObj?.dataFim || ''}">
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-sec" id="btn-modal-cancelar">Cancelar</button>
          <button type="submit" class="btn-pri">${item ? 'Salvar alterações' : 'Criar item'}</button>
        </div>

      </form>
    </div>
  `;
}
