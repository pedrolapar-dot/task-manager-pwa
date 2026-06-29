import { db } from '../db.js';
import { renderCard, escapeHtml } from '../components/card.js';

export function render(container, query) {
  if (!query || query.trim().length < 2) {
    container.innerHTML = `
      <div class="search-view">
        <div class="search-hint">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <p>Digite ao menos 2 caracteres para buscar.</p>
        </div>
      </div>
    `;
    return;
  }

  const resultados = db.buscar(query);

  container.innerHTML = `
    <div class="search-view">
      <div class="search-header">
        ${resultados.length > 0
          ? `<span class="search-count">${resultados.length} resultado${resultados.length !== 1 ? 's' : ''} para <strong>"${escapeHtml(query)}"</strong></span>`
          : `<span class="search-count search-vazio">Nenhum resultado para <strong>"${escapeHtml(query)}"</strong></span>`
        }
      </div>
      ${resultados.length > 0 ? `
        <div class="search-results">
          ${resultados.map(item => renderCard(item)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}
