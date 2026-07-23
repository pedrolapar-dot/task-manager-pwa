import { db } from '../db.js';
import { escapeHtml, TIPO_LABEL, PRIO_LABEL, STATUS_LABEL } from './card.js';
import { formatarData, formatarDiaSemana, hoje } from '../dateUtils.js';

// Modal de detalhes (somente leitura) — usado fora da aba Gestão.
// Única interação permitida: marcar/desmarcar subtarefas e, em itens
// recorrentes, concluir/reabrir a ocorrência exibida.

let _onChange = null;

export function initDetailModal(onChangeCb) {
  _onChange = onChangeCb;
}

export function openDetailModal(itemId, { ocorrencia = null } = {}) {
  const item = db.getById(itemId);
  if (!item) return;
  renderDetalhe(itemId, ocorrencia);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeDetail() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal').innerHTML = '';
}

function renderDetalhe(itemId, ocorrencia) {
  const item = db.getById(itemId);
  if (!item) { closeDetail(); return; }

  const modal = document.getElementById('modal');
  modal.innerHTML = html(item, ocorrencia);

  modal.querySelector('#btn-detail-fechar').addEventListener('click', closeDetail);

  // Subtarefas: única edição permitida fora da Gestão.
  // Itens recorrentes guardam a conclusão POR DIA (subtarefasPorDia);
  // itens normais usam a flag concluida da própria subtarefa.
  modal.querySelectorAll('.detail-sub-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const subId = cb.dataset.subid;
      const orig  = db.getById(itemId);
      if (!orig) return;

      if (orig.recorrente && ocorrencia) {
        const mapa  = { ...(orig.subtarefasPorDia || {}) };
        const doDia = new Set(mapa[ocorrencia] || []);
        if (cb.checked) doDia.add(subId); else doDia.delete(subId);
        if (doDia.size > 0) mapa[ocorrencia] = [...doDia];
        else delete mapa[ocorrencia];
        db.update(itemId, { subtarefasPorDia: mapa });
      } else {
        const subs = (orig.subtarefas || []).map(s =>
          s.id === subId ? { ...s, concluida: cb.checked, atualizadoEm: new Date().toISOString() } : s
        );
        db.update(itemId, { subtarefas: subs });
      }

      _onChange?.();
      renderDetalhe(itemId, ocorrencia);
    });
  });

  // Ocorrência de item recorrente: concluir/reabrir só existe por dia
  const occBtn = modal.querySelector('#btn-toggle-ocorrencia');
  if (occBtn) {
    occBtn.addEventListener('click', () => {
      const orig = db.getById(itemId);
      if (!orig) return;
      const concluidas = [...(orig.ocorrenciasConcluidas || [])];
      const i = concluidas.indexOf(ocorrencia);
      if (i >= 0) concluidas.splice(i, 1);
      else concluidas.push(ocorrencia);
      db.update(itemId, { ocorrenciasConcluidas: concluidas });
      _onChange?.();
      renderDetalhe(itemId, ocorrencia);
    });
  }
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

const ICONS = {
  data:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  hora:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  prazo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  status:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>',
  rec:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  tags:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
};

function infoRow(icon, label, valorHtml, extraClass = '') {
  return `
    <div class="detail-row ${extraClass}">
      <span class="detail-row-icon">${ICONS[icon]}</span>
      <span class="detail-row-label">${label}</span>
      <span class="detail-row-valor">${valorHtml}</span>
    </div>
  `;
}

function descreverRecorrencia(item) {
  const r = item.recorrencia;
  if (!r) return 'Recorrente';
  const n = Math.max(1, r.intervalo || 1);
  let base = '';
  if (r.frequencia === 'diaria') {
    base = n === 1 ? 'Todos os dias' : `A cada ${n} dias`;
  } else if (r.frequencia === 'semanal') {
    const LBL = { seg:'Seg', ter:'Ter', qua:'Qua', qui:'Qui', sex:'Sex', sab:'Sáb', dom:'Dom' };
    const dias = (r.diasSemana || []).map(d => LBL[d] || d).join(', ');
    base = (n === 1 ? 'Toda semana' : `A cada ${n} semanas`) + (dias ? ` · ${dias}` : '');
  } else if (r.frequencia === 'mensal') {
    base = (n === 1 ? 'Todo mês' : `A cada ${n} meses`) + (r.diaMes ? ` · dia ${r.diaMes}` : '');
  }
  if (r.dataFim) base += ` · até ${formatarData(r.dataFim)}`;
  return base;
}

function html(item, ocorrencia) {
  const hj = hoje();
  const isVirtual    = !!ocorrencia;
  const occConcluida = isVirtual && (item.ocorrenciasConcluidas || []).includes(ocorrencia);
  const concluido    = isVirtual ? occConcluida : item.status === 'concluido';

  const dataExibida = isVirtual ? ocorrencia : item.data;

  const prazoVencido = item.prazo && item.prazo < hj && !['concluido','cancelado','arquivado'].includes(item.status);
  const prazoHoje    = item.prazo && item.prazo === hj;
  const prazoClass   = prazoVencido ? 'detail-prazo-vencido' : (prazoHoje ? 'detail-prazo-hoje' : '');
  const prazoSufixo  = prazoVencido ? ' · vencido' : (prazoHoje ? ' · hoje' : '');

  const statusLabel = isVirtual
    ? (occConcluida ? 'Concluída (esta ocorrência)' : (STATUS_LABEL[item.status] || item.status))
    : (STATUS_LABEL[item.status] || item.status);

  const subtarefas = item.subtarefas || [];
  const subTotal   = subtarefas.length;

  // Recorrente: conclusão por dia; normal: flag da subtarefa
  const feitasDoDia = new Set(isVirtual ? ((item.subtarefasPorDia || {})[ocorrencia] || []) : []);
  const subConcluida = (s) => item.recorrente ? feitasDoDia.has(s.id) : !!s.concluida;

  // Recorrente aberto sem dia (ex.: pela busca): lista sem checkbox
  const podeMarcarSubs = !item.recorrente || isVirtual;

  const subFeitas = subtarefas.filter(subConcluida).length;
  const subPct    = subTotal > 0 ? Math.round((subFeitas / subTotal) * 100) : 0;

  return `
    <div class="modal-inner detail-inner">
      <div class="detail-header">
        <div class="card-badges">
          <span class="badge tipo-${item.tipo}">${TIPO_LABEL[item.tipo] || item.tipo}</span>
          <span class="badge prio-${item.prioridade}">${PRIO_LABEL[item.prioridade] || item.prioridade}</span>
          ${item.recorrente ? `<span class="badge badge-recorrente">${ICONS.rec} Recorrente</span>` : ''}
        </div>
        <button class="modal-close-btn" id="btn-detail-fechar" type="button" aria-label="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <h2 class="detail-titulo${concluido ? ' riscado' : ''}">${escapeHtml(item.titulo)}</h2>

      <div class="detail-info">
        ${dataExibida ? infoRow('data', 'Data', formatarDiaSemana(dataExibida)) : ''}
        ${item.horaInicio ? infoRow('hora', 'Horário', `${item.horaInicio}${item.horaFim ? ' – ' + item.horaFim : ''}`) : ''}
        ${item.prazo ? infoRow('prazo', 'Prazo', `${formatarData(item.prazo)}${prazoSufixo}`, prazoClass) : ''}
        ${infoRow('status', 'Status', escapeHtml(statusLabel))}
        ${item.recorrente ? infoRow('rec', 'Repete', escapeHtml(descreverRecorrencia(item))) : ''}
        ${(item.tags || []).length > 0
          ? infoRow('tags', 'Tags', item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' '))
          : ''}
      </div>

      ${item.descricao ? `
        <div class="detail-descricao">
          <div class="detail-section-label">Descrição</div>
          <p class="detail-descricao-texto">${escapeHtml(item.descricao)}</p>
        </div>
      ` : ''}

      ${subTotal > 0 ? `
        <div class="detail-subtarefas">
          <div class="detail-section-label">
            Subtarefas${item.recorrente && isVirtual ? ' do dia' : ''}
            ${podeMarcarSubs ? `<span class="detail-sub-count">${subFeitas}/${subTotal}</span>` : `<span class="detail-sub-count">${subTotal}</span>`}
          </div>
          ${podeMarcarSubs ? `
            <div class="detail-progress"><div class="detail-progress-fill${subFeitas === subTotal ? ' completo' : ''}" style="width:${subPct}%"></div></div>
          ` : ''}
          <div class="detail-sub-list">
            ${subtarefas.map(s => podeMarcarSubs ? `
              <label class="subtarefa-item detail-sub-item">
                <input type="checkbox" class="subtarefa-check detail-sub-check" data-subid="${s.id}" ${subConcluida(s) ? 'checked' : ''}>
                <span class="subtarefa-label${subConcluida(s) ? ' riscado' : ''}">${escapeHtml(s.titulo)}</span>
              </label>
            ` : `
              <div class="subtarefa-item detail-sub-item detail-sub-item-plain">
                <span class="subtarefa-bullet"></span>
                <span class="subtarefa-label">${escapeHtml(s.titulo)}</span>
              </div>
            `).join('')}
          </div>
          ${!podeMarcarSubs ? `
            <p class="detail-sub-nota">Este item se repete: as subtarefas são marcadas por dia, abrindo o item na aba Dia, Semana ou Mês.</p>
          ` : ''}
        </div>
      ` : ''}

      ${isVirtual ? `
        <button type="button" class="btn-ocorrencia${occConcluida ? ' btn-ocorrencia-feita' : ''}" id="btn-toggle-ocorrencia">
          ${occConcluida
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Ocorrência concluída · toque para reabrir`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg> Concluir esta ocorrência`}
        </button>
      ` : ''}

      <p class="detail-hint">Para criar ou editar itens, use a aba <strong>Gestão</strong>.</p>
    </div>
  `;
}
