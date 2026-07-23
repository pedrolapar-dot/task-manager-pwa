// ─── Ordenação compartilhada entre as views ──────────────────────────────────

const PESO_PRIO = { urgente: 0, alta: 1, media: 2, baixa: 3 };

function cmpPrio(a, b) {
  return (PESO_PRIO[a.prioridade] ?? 2) - (PESO_PRIO[b.prioridade] ?? 2);
}

function cmpTitulo(a, b) {
  return (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR');
}

/**
 * Ordena itens de um mesmo dia: com horário primeiro (mais cedo → mais tarde),
 * depois os sem horário (por prioridade, depois título).
 */
export function ordenarPorHorario(items) {
  return [...items].sort((a, b) => {
    const ha = a.horaInicio || null;
    const hb = b.horaInicio || null;
    if (ha && hb) return ha.localeCompare(hb) || cmpPrio(a, b) || cmpTitulo(a, b);
    if (ha) return -1;
    if (hb) return 1;
    return cmpPrio(a, b) || cmpTitulo(a, b);
  });
}

/**
 * Ordena itens de uma coluna do kanban: data mais próxima primeiro (sem data
 * por último), depois horário, depois prioridade.
 */
export function ordenarKanban(items) {
  return [...items].sort((a, b) => {
    const da = a.data || a.prazo || '9999-99-99';
    const db = b.data || b.prazo || '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    const ha = a.horaInicio || '99:99';
    const hb = b.horaInicio || '99:99';
    return ha.localeCompare(hb) || cmpPrio(a, b) || cmpTitulo(a, b);
  });
}
