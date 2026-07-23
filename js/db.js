import { storage } from './storage.js';
import { hoje, addDias } from './dateUtils.js';

let _items = [];
let _afterSave = null;

export function onAfterSave(cb) { _afterSave = cb; }

function defaults(dados) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    titulo: '',
    tipo: 'tarefa',
    descricao: '',
    data: null,
    horaInicio: null,
    horaFim: null,
    prazo: null,
    prioridade: 'media',
    status: 'backlog',
    tags: [],
    subtarefas: [],
    subtarefasPorDia: {},
    recorrente: false,
    recorrencia: null,
    ocorrenciasConcluidas: [],
    ocorrenciasIgnoradas: [],
    criadoEm: now,
    atualizadoEm: now,
    ...dados,
  };
}

// Remove espaços e pontos finais acidentais ("Trabalho." → "Trabalho") e duplicatas
function normalizarTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  tags.forEach(t => {
    const limpa = String(t).trim().replace(/\.+$/, '').trim();
    if (limpa && !out.includes(limpa)) out.push(limpa);
  });
  return out;
}

function migrar(i) {
  return {
    subtarefas: [],
    subtarefasPorDia: {},
    recorrencia: null,
    ocorrenciasConcluidas: [],
    ocorrenciasIgnoradas: [],
    ...i,
    tags: normalizarTags(i.tags),
  };
}

export const db = {
  init() {
    _items = storage.load();
    // Migra itens antigos: adiciona campos novos se ausentes, normaliza tags
    _items = _items.map(migrar);
    if (_items.length === 0) {
      _items = criarExemplos();
      storage.save(_items);
    }
  },

  getAll() { return [..._items]; },

  getById(id) { return _items.find(i => i.id === id) || null; },

  getByData(dateStr) {
    return _items.filter(i => !i.recorrente && i.data === dateStr);
  },

  getByPrazo(dateStr) {
    return _items.filter(i => !i.recorrente && i.prazo === dateStr && i.data !== dateStr);
  },

  getRecorrentes() {
    return _items.filter(i => i.recorrente);
  },

  getBySemana(inicio, fim) {
    return _items.filter(i => {
      if (i.recorrente) return false;
      return (i.data && i.data >= inicio && i.data <= fim) ||
             (i.prazo && i.prazo >= inicio && i.prazo <= fim);
    });
  },

  getByMes(ano, mes) {
    const prefix = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    return _items.filter(i => {
      if (i.recorrente) return false;
      return (i.data && i.data.startsWith(prefix)) ||
             (i.prazo && i.prazo.startsWith(prefix));
    });
  },

  filter({ tipo, prioridade, status, tags } = {}) {
    return _items.filter(i => {
      if (tipo && i.tipo !== tipo) return false;
      if (prioridade && i.prioridade !== prioridade) return false;
      if (status && i.status !== status) return false;
      if (tags && tags.length > 0 && !tags.every(t => i.tags.includes(t))) return false;
      return true;
    });
  },

  buscar(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return _items
      .filter(i =>
        i.titulo.toLowerCase().includes(q) ||
        (i.descricao && i.descricao.toLowerCase().includes(q)) ||
        i.tags.some(t => t.toLowerCase().includes(q)) ||
        i.tipo.toLowerCase().includes(q) ||
        i.status.replace('_', ' ').includes(q) ||
        i.prioridade.includes(q)
      )
      .sort((a, b) => {
        const da = a.data || a.prazo || '9999';
        const db2 = b.data || b.prazo || '9999';
        if (da !== db2) return da < db2 ? -1 : 1;
        // Mesmo dia: mais cedo primeiro, sem horário por último
        const ha = a.horaInicio || '99:99';
        const hb = b.horaInicio || '99:99';
        return ha.localeCompare(hb);
      });
  },

  create(dados) {
    const item = defaults(dados);
    item.tags = normalizarTags(item.tags);
    _items.push(item);
    storage.save(_items);
    _afterSave?.();
    return item;
  },

  update(id, dados) {
    const idx = _items.findIndex(i => i.id === id);
    if (idx === -1) return null;
    if (dados.tags) dados = { ...dados, tags: normalizarTags(dados.tags) };
    _items[idx] = { ..._items[idx], ...dados, atualizadoEm: new Date().toISOString() };
    storage.save(_items);
    _afterSave?.();
    return _items[idx];
  },

  delete(id) {
    _items = _items.filter(i => i.id !== id);
    storage.save(_items);
    _afterSave?.();
  },

  exportJSON() {
    return { schemaVersion: 1, exportedAt: new Date().toISOString(), items: [..._items] };
  },

  importJSON(json) {
    if (!json || typeof json !== 'object') throw new Error('JSON inválido.');
    if (!json.schemaVersion || !Array.isArray(json.items)) throw new Error('Formato de backup inválido.');
    if (json.schemaVersion !== 1) throw new Error(`Versão de schema não suportada: ${json.schemaVersion}`);
    _items = json.items.map(migrar);
    storage.save(_items);
    _afterSave?.();
  },
};

function criarExemplos() {
  const agora = new Date().toISOString();
  const hj = hoje();
  const make = (dados) => defaults({ criadoEm: agora, atualizadoEm: agora, ...dados });

  return [
    // Itens regulares
    make({ titulo: 'Revisar proposta de projeto', tipo: 'tarefa', prioridade: 'alta', status: 'em_andamento', data: hj, horaInicio: '10:00', tags: ['trabalho'] }),
    make({ titulo: 'Reunião de alinhamento com time', tipo: 'reuniao', prioridade: 'urgente', status: 'ativo', data: hj, horaInicio: '14:00', horaFim: '15:00', tags: ['trabalho'] }),
    make({ titulo: 'Entrega do relatório mensal', tipo: 'entrega', prioridade: 'alta', status: 'ativo', prazo: addDias(hj, 2), tags: ['trabalho'] }),
    make({ titulo: 'Call com cliente', tipo: 'reuniao', prioridade: 'alta', status: 'ativo', data: addDias(hj, 1), horaInicio: '11:00', horaFim: '11:30', tags: ['trabalho', 'cliente'] }),
    make({ titulo: 'Deploy versão 2.0', tipo: 'entrega', prioridade: 'urgente', status: 'aguardando', prazo: addDias(hj, 5), tags: ['trabalho', 'dev'] }),
    make({ titulo: 'Comprar mantimentos', tipo: 'tarefa', prioridade: 'baixa', status: 'backlog', tags: ['pessoal'] }),

    // Item com subtarefas
    make({
      titulo: 'Setup do novo servidor',
      tipo: 'projeto', prioridade: 'alta', status: 'em_andamento',
      data: hj, tags: ['dev', 'infra'],
      subtarefas: [
        { id: crypto.randomUUID(), titulo: 'Configurar DNS',           concluida: true,  criadoEm: agora, atualizadoEm: agora },
        { id: crypto.randomUUID(), titulo: 'Instalar dependências',    concluida: true,  criadoEm: agora, atualizadoEm: agora },
        { id: crypto.randomUUID(), titulo: 'Configurar SSL',           concluida: false, criadoEm: agora, atualizadoEm: agora },
        { id: crypto.randomUUID(), titulo: 'Testar deploy',            concluida: false, criadoEm: agora, atualizadoEm: agora },
      ],
    }),

    // Recorrência diária
    make({
      titulo: 'Daily standup',
      tipo: 'reuniao', prioridade: 'alta', status: 'ativo',
      data: addDias(hj, -7), horaInicio: '09:00', horaFim: '09:15',
      tags: ['trabalho', 'daily'],
      recorrente: true,
      recorrencia: { frequencia: 'diaria', intervalo: 1, diasSemana: [], diaMes: null, dataFim: null },
      ocorrenciasConcluidas: [], ocorrenciasIgnoradas: [],
    }),

    // Recorrência semanal (seg, qua, sex)
    make({
      titulo: 'Review de código',
      tipo: 'tarefa', prioridade: 'media', status: 'ativo',
      data: addDias(hj, -14),
      tags: ['trabalho', 'dev'],
      recorrente: true,
      recorrencia: { frequencia: 'semanal', intervalo: 1, diasSemana: ['seg', 'qua', 'sex'], diaMes: null, dataFim: null },
      ocorrenciasConcluidas: [], ocorrenciasIgnoradas: [],
    }),

    // Recorrência mensal (dia 28)
    make({
      titulo: 'Fechar mês financeiro',
      tipo: 'tarefa', prioridade: 'alta', status: 'ativo',
      data: addDias(hj, -60),
      tags: ['financeiro'],
      recorrente: true,
      recorrencia: { frequencia: 'mensal', intervalo: 1, diasSemana: [], diaMes: 28, dataFim: null },
      ocorrenciasConcluidas: [], ocorrenciasIgnoradas: [],
    }),
  ];
}
