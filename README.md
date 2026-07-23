# Task Manager PWA

Agenda pessoal completa do Pedro: tarefas, projetos, reuniões, treinos e eventos.
PWA instalável no celular e no Mac, sem dependências externas — HTML, CSS e
JavaScript puro, hospedado no GitHub Pages.

**App no ar:** https://pedrolapar-dot.github.io/task-manager-pwa/

---

## Como o app funciona (regras principais)

- **Criar e editar itens: só na aba Gestão** (kanban). O botão ➕ e o menu ⋮
  dos cards existem apenas lá.
- **Fora da Gestão** (Dia, Semana, Mês, busca), tocar num card abre o **modal
  de detalhes** (somente leitura). Ali dá para: marcar/desmarcar subtarefas,
  concluir/reabrir a ocorrência de itens recorrentes, e exportar o item para
  o calendário.
- **Check rápido:** todo card fora da Gestão tem um círculo — um toque conclui
  (item ou ocorrência do dia), outro reabre.
- **Ordenação por horário** em todas as views: com horário primeiro (mais cedo
  → mais tarde), sem horário depois (por prioridade).
- **Subtarefas de itens recorrentes são por dia** (`subtarefasPorDia`): o
  checklist zera a cada ocorrência e cada data lembra o que foi marcado.
  Ex.: treino de academia — os exercícios recomeçam desmarcados toda semana.
  Na Gestão se edita só a estrutura do checklist.
- **Aba Dia (em "hoje")**: seção *Atrasadas* (itens de dias anteriores em
  aberto — pausados não contam), linha vermelha do horário atual, chips
  "agora" / "a seguir", atualização automática a cada minuto.
- **Notificações via calendário (.ics):** itens marcados com **"Notificar"**
  no formulário entram na exportação da agenda (botão de calendário no topo /
  na Gestão). O arquivo importa no calendário nativo com alerta 15 min antes;
  recorrentes viram série (RRULE). É uma exportação pontual — mudou o item,
  exporta de novo.
- **Kanban:** colunas recolhíveis no desktop (clique no cabeçalho; Cancelado e
  Arquivado começam recolhidas), chips deslizáveis no mobile, recorrentes
  mostram/ordenam pela próxima ocorrência, botão de arquivar concluídos,
  "Duplicar" no menu ⋮.
- **Histórico/streak:** modal de detalhes de item recorrente mostra as últimas
  5 ocorrências e a sequência atual (feita = ocorrência concluída OU todas as
  subtarefas do dia marcadas).

### Tipos, status e prioridades

- Tipos: `tarefa · projeto · reuniao · entrega · evento · lembrete · feriado`
- Status (colunas do kanban): `backlog · ativo · em_andamento · aguardando ·
  pausado · concluido · cancelado · arquivado`
- Prioridades: `baixa · media · alta · urgente`

---

## Dados

Salvos no **localStorage** (`tmw_items`) e sincronizados com o **Google Drive**
(`appDataFolder`, arquivo `task-manager-data.json`). O Drive também guarda
**snapshots diários** (`task-manager-snapshot-YYYY-MM-DD.json`, últimos 7) como
seguro extra.

Campos de um item (schema v1):

```
id, titulo, tipo, descricao, data, horaInicio, horaFim, prazo, prioridade,
status, tags[], notificar, subtarefas[{id, titulo, concluida, ...}],
subtarefasPorDia{ 'YYYY-MM-DD': [subId,...] },   // recorrentes: feitas por dia
recorrente, recorrencia{frequencia, intervalo, diasSemana, diaMes, dataFim},
ocorrenciasConcluidas[], ocorrenciasIgnoradas[], criadoEm, atualizadoEm
```

Campos novos são adicionados por migração em `db.js` (`migrar()`) — dados
antigos continuam válidos. Tags são normalizadas ao salvar/carregar (sem
espaços/pontos finais, sem duplicatas).

⚠️ Nunca limpar "dados de site" do navegador — apaga o localStorage. O backup
JSON (Exportar/Importar) e o Drive existem pra isso.

---

## Como atualizar o app nos aparelhos

Depois de qualquer `git push`, o GitHub Pages publica sozinho (~1 min).
Nos aparelhos é **automático**: ao abrir o app (ou voltar pra ele), o service
worker checa se há versão nova e, se houver, o app se recarrega sozinho em
poucos segundos (a menos que um modal esteja aberto — aí atualiza na próxima
abertura). O SW usa stale-while-revalidate com `cache: 'no-cache'`.

Ao mudar arquivos JS/CSS: **dar bump no `CACHE_NAME`** do `service-worker.js`
e adicionar arquivos novos à lista `ARQUIVOS`.

---

## Rodar localmente

```bash
cd task-manager-pwa
python3 -m http.server 8787   # → http://localhost:8787/
```

Dica para testar mudanças sem briga de cache: servir com `Cache-Control:
no-store` (ou recarregar duas vezes — a primeira revalida, a segunda pega).

---

## Estrutura

```
├── index.html               # Shell do app
├── styles.css               # Todo o CSS (dark, mobile-first)
├── manifest.webmanifest     # PWA (paths relativos)
├── service-worker.js        # Cache offline, stale-while-revalidate
├── assets/icons/            # Ícones PWA
└── js/
    ├── app.js               # Bootstrap, estado, eventos, Drive sync, FAB
    ├── config.js            # GOOGLE_CLIENT_ID (Drive)
    ├── googleAuth.js        # OAuth (Google Identity Services)
    ├── driveSync.js         # Upload/download no Drive + snapshots diários
    ├── db.js                # CRUD + migração + normalização de tags
    ├── storage.js           # localStorage
    ├── dateUtils.js         # Datas, semanas, recorrência, próxima ocorrência
    ├── sortUtils.js         # Ordenação por horário e do kanban
    ├── ics.js               # Exportação de calendário (.ics)
    ├── components/
    │   ├── card.js          # Cards (check rápido, próx. ocorrência, badges)
    │   ├── modal.js         # Criar/editar (chips de tipo/prio, seções, tags)
    │   └── detailModal.js   # Detalhes somente leitura (subtarefas por dia,
    │                        #   histórico/streak, ocorrência, calendário)
    └── views/
        ├── dayView.js       # Dia (atrasadas, linha do agora, timeline)
        ├── weekView.js      # Semana (dias vazios compactos no mobile)
        ├── monthView.js     # Mês (calendário + detalhe do dia)
        ├── kanbanView.js    # Gestão (colunas recolhíveis, chips, filtros)
        └── searchView.js    # Busca global
```

---

## Limitações conhecidas

- **Sem push notification nativa** — o caminho é a exportação .ics (itens com
  "Notificar" ligado). Push de verdade exigiria um servidor.
- **Editar item recorrente altera a série inteira** (exceto concluir
  ocorrência e marcar subtarefas, que são por dia).
- **iOS:** downloads (.json/.ics) abrem a folha de compartilhar em vez de
  baixar direto — comportamento do iOS. No app instalado, o layout respeita as
  safe areas (barra de status e barrinha do home) via `env(safe-area-inset-*)`.
- **Snapshots do Drive não têm UI de restauração** — em caso de desastre, é
  possível restaurar manualmente (os arquivos estão no appDataFolder).
