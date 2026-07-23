# Estado do projeto e próximos passos

Atualizado em 2026-07-23. Para o panorama completo do app, veja o `README.md`.
Histórico detalhado de mudanças: `git log`.

---

## Onde o projeto está

Todas as fases planejadas originalmente foram entregues, e mais:

- ✅ **Fase 1** — App base (Dia/Semana/Mês/Gestão, busca, subtarefas, recorrência, backup)
- ✅ **Fase 2** — Google Drive Sync (instruções de configuração abaixo)
- ✅ **Fase "agenda"** (jul/2026) — edição só na Gestão, modal de detalhes
  read-only, ordenação por horário, subtarefas por dia em recorrentes,
  exportação .ics com opt-in "Notificar", streaks, linha do agora, atrasadas,
  check rápido, colunas recolhíveis, chips no mobile, snapshots no Drive,
  formulário com chips e seções.

A pasta ativa deste projeto é **`task-manager-pwa-github-sync`** (remote:
`pedrolapar-dot/task-manager-pwa`, publica no GitHub Pages). A pasta irmã
`task-manager-pwa` é uma cópia antiga, desatualizada — não usar.

---

## Backlog de ideias (não implementadas)

Em ordem aproximada de valor:

1. **UI de restauração de snapshots** — o Drive guarda 7 snapshots diários,
   mas restaurar hoje é manual. Uma telinha "restaurar backup de <data>"
   fecharia o ciclo.
2. **Auto-concluir ocorrência** quando todas as subtarefas do dia forem
   marcadas (decidido não fazer por ora: mudança de estado automática pode
   surpreender — revisitar se o Pedro pedir).
3. **Fusão de status** — 8 status é muito ("Ativo" × "Em andamento" é fuzzy).
   Exigiria migração de dados; colunas recolhíveis já atenuam.
4. **Edição de ocorrência individual** (exceções na série: mudar horário só
   de um dia, etc.).
5. **Push notification real** — exige backend (Web Push/FCM); hoje o caminho
   é o .ics.
6. **Entrada rápida por texto** ("reunião amanhã 10h #Trabalho").

## Avisos para quem for mexer no código

- **Service worker:** ao mudar JS/CSS, bump no `CACHE_NAME` + arquivos novos
  na lista `ARQUIVOS`. As buscas do SW usam `cache: 'no-cache'` de propósito
  (sem isso o cache HTTP heurístico segura versão velha — bug real já vivido).
- **Datas são locais** (`hoje()` em `dateUtils.js`). Nunca usar
  `toISOString().slice(0,10)` para "hoje" — fuso é UTC-3.
- **Campos novos no item:** adicionar em `defaults()` E `migrar()` no `db.js`.
- **Drive:** não mexer em `config.js` / `googleAuth.js` sem necessidade; o
  sync roda em cima de `onAfterSave` com debounce de 3s. Snapshots
  (`snapshotDiario`) são fire-and-forget e nunca podem lançar erro.

---

## Configuração do Google Drive Sync (referência)

Já está configurado e funcionando. Se um dia precisar refazer:

1. [console.cloud.google.com](https://console.cloud.google.com/) → projeto →
   ativar **Google Drive API** → Credenciais → **ID do cliente OAuth 2.0**
   (Aplicativo da Web).
2. Origens JavaScript autorizadas: `http://localhost:8787` e
   `https://pedrolapar-dot.github.io`.
3. Colar o Client ID em `js/config.js` (`GOOGLE_CLIENT_ID`).
4. Escopo usado: `drive.appdata` (pasta privada do app). Arquivo principal:
   `task-manager-data.json`; snapshots: `task-manager-snapshot-*.json`.
5. Fluxo: "Conectar Drive" → autorizar → primeira conexão pergunta qual versão
   usar se houver dados dos dois lados; depois, sync automático 3s após
   qualquer alteração.
