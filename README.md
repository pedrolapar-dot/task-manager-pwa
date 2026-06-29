# Task Manager PWA

Gerenciador pessoal de tarefas, projetos, entregas e agenda. PWA instalável no celular e no Mac via navegador, sem dependências externas — HTML, CSS e JavaScript puro.

---

## Funcionalidades

### Visão geral
- **4 abas principais:** Dia, Semana, Mês e Gestão (Kanban)
- **Busca global** em tempo real (título, descrição, tags, tipo, status, prioridade)
- **Subtarefas** com progresso por item
- **Recorrência** diária, semanal e mensal com expansão dinâmica
- **Backup JSON** — exportar e importar todos os dados
- **PWA instalável** no celular (Android/iOS) e no Mac via browser

### Tipos de item
`Tarefa`, `Projeto`, `Reunião`, `Entrega`, `Feriado`, `Evento`, `Lembrete`

### Status (colunas Kanban)
`Backlog` → `Ativo` → `Em andamento` → `Aguardando` → `Pausado` → `Concluído` → `Cancelado` → `Arquivado`

### Prioridades
`Urgente`, `Alta`, `Média`, `Baixa`

### Recorrência
- **Diária:** a cada N dias
- **Semanal:** dias específicos da semana + a cada N semanas
- **Mensal:** dia do mês + a cada N meses
- Ocorrências são geradas dinamicamente — não ficam salvas no localStorage
- Concluir ou remover uma ocorrência específica não afeta as demais
- Editar ou mover no Kanban afeta toda a série

### Subtarefas
- Lista de checklist dentro de cada item
- Badge `X/Y` exibido no card; fica verde quando todas estão concluídas
- Gerenciadas no modal de edição

### Backup
- **Exportar:** gera arquivo `.json` com todos os dados
- **Importar:** restaura dados a partir de um arquivo `.json` (substitui tudo, com confirmação)
- No **desktop:** botões no canto superior direito
- No **mobile:** botões na aba Gestão

---

## Dados e armazenamento

Os dados ficam salvos no **localStorage do navegador**. Isso significa:

- Nenhuma conta, nenhum servidor, nenhum dado enviado a terceiros
- Se você limpar o cache do browser ou trocar de dispositivo, os dados somem
- Use o **export/import** para fazer backup antes de limpar o browser ou migrar de dispositivo
- Cada browser/dispositivo tem seu próprio localStorage independente

---

## Como rodar localmente

O app é estático — não precisa de build. Basta abrir o terminal, entrar na pasta do projeto e rodar um servidor HTTP.

### Passo a passo

```bash
cd caminho/para/task-manager-pwa
python3 -m http.server 8787
```

Depois abra no navegador:

```
http://localhost:8787/
```

> O terminal precisa continuar aberto enquanto o app estiver sendo testado. Fechar o terminal encerra o servidor.

### Alternativas (mesma lógica, mesma URL)

```bash
# Node.js / npx
npx serve . -p 8787

# VS Code Live Server: botão direito em index.html → "Open with Live Server"
# (a porta pode ser diferente — verifique na barra de endereço do browser)
```

> **Importante:** sempre entre na pasta `task-manager-pwa` antes de iniciar o servidor. O app deve abrir em `http://localhost:8787/` (raiz), não em `/task-manager-pwa/`. O Service Worker e o manifest são configurados automaticamente para o ambiente detectado.

---

## Como publicar no GitHub Pages

1. Crie um repositório público chamado `task-manager-pwa` em [github.com/pedrolapar](https://github.com/pedrolapar).
2. Dentro da pasta `task-manager-pwa`, rode:

```bash
git init
git remote add origin https://github.com/pedrolapar/task-manager-pwa.git
git add .
git commit -m "feat: versão 1 — task manager pwa"
git push -u origin main
```

3. No GitHub: **Settings → Pages → Branch: main / folder: / (root)** → Save.
4. Aguarde ~1 minuto. O app estará em:

```
https://pedrolapar.github.io/task-manager-pwa/
```

O app detecta automaticamente o ambiente — o mesmo código funciona em `localhost:8787/` e em `/task-manager-pwa/` no GitHub Pages.

---

## Como instalar como PWA

### Android (Chrome)
1. Abra o app no Chrome
2. Menu ⋮ → "Adicionar à tela inicial"
3. Confirme → aparece como app nativo

### iPhone / iPad (Safari)
1. Abra o app no Safari
2. Botão de compartilhar → "Adicionar à Tela de Início"
3. Confirme → aparece no home screen

### Mac (Chrome ou Edge)
1. Abra o app no Chrome ou Edge
2. Ícone de instalar na barra de endereço (ou Menu → "Instalar Task Manager")
3. Confirme → abre como janela separada, sem barra do browser

---

## Estrutura do projeto

```
task-manager-pwa/
├── index.html               # Shell do app
├── styles.css               # Todo o CSS (dark mode, mobile-first)
├── manifest.webmanifest     # Configuração PWA (paths relativos)
├── service-worker.js        # Cache offline (detecta ambiente automaticamente)
├── .gitignore
├── NEXT_STEPS.md            # Plano de evolução (Google Drive sync, etc.)
├── assets/
│   └── icons/               # Ícones PWA (192px e 512px)
└── js/
    ├── app.js               # Inicialização, estado, eventos globais
    ├── db.js                # CRUD em memória + persistência
    ├── storage.js           # Abstração do localStorage
    ├── dateUtils.js         # Datas, semanas, meses, recorrência
    ├── components/
    │   ├── card.js          # Renderização de cards
    │   └── modal.js         # Modal de criação/edição
    └── views/
        ├── dayView.js       # Aba Dia (timeline)
        ├── weekView.js      # Aba Semana (grid 7 colunas)
        ├── monthView.js     # Aba Mês (calendário)
        ├── kanbanView.js    # Aba Gestão (Kanban + filtros + backup)
        └── searchView.js    # View de busca global
```

---

## Limitações conhecidas

- **Sem sincronização:** dados ficam no localStorage do dispositivo. Não sincroniza entre navegadores ou dispositivos automaticamente. Veja `NEXT_STEPS.md` para o plano de integração com Google Drive.
- **Sem notificações push:** lembretes e horários não geram alertas nativos.
- **iOS Safari PWA:** ao adicionar à tela inicial no iOS, o app perde o contexto do Safari — cada abertura reinicia o browser interno. O localStorage é mantido.
- **Exportação no iOS:** o arquivo JSON é exibido no browser em vez de baixado diretamente (comportamento nativo do iOS). Use "Compartilhar → Salvar em Arquivos" para guardar.
- **Recorrência no Kanban:** mover um item recorrente no Kanban altera o status da série inteira, não de uma ocorrência específica.
- **Sem modo de edição por ocorrência:** editar um item recorrente sempre altera toda a série.
