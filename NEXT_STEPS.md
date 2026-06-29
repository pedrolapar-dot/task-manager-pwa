# Próximas Evoluções — Task Manager PWA

Este documento detalha o plano para a **Fase 2: Sincronização com Google Drive**, que deverá ser implementada após a publicação da Versão 1 no GitHub Pages.

---

## Fase 2 — Sincronização com Google Drive

### Objetivo

Permitir que o usuário salve e carregue os dados do app diretamente no **Google Drive pessoal**, eliminando a dependência do localStorage do navegador. Isso resolve os dois maiores limitantes da V1:

- **Perda de dados** ao limpar o cache do browser
- **Sem sincronização** entre dispositivos diferentes

### Abordagem técnica

A integração usa a **Google Drive API v3** com a pasta especial `appDataFolder` — um espaço privado e invisível no Drive do usuário, exclusivo para dados deste app. O usuário não vê os arquivos no Drive, mas eles existem e são sincronizados automaticamente.

### Pré-requisitos

1. Criar um projeto no [Google Cloud Console](https://console.cloud.google.com/)
2. Ativar a **Google Drive API** no projeto
3. Criar credenciais **OAuth 2.0** do tipo "Aplicativo da Web"
4. Adicionar `https://SEU_USUARIO.github.io` nas origens autorizadas
5. Copiar o `Client ID` gerado

### Estrutura de implementação

#### 1. Arquivo de configuração (`js/config.js`)

```js
// Substituir pelo Client ID do Google Cloud Console
export const GOOGLE_CLIENT_ID = "COLE_AQUI_SEU_CLIENT_ID";
export const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.appdata";
export const DRIVE_FILE_NAME = "task-manager-backup.json";
```

#### 2. Módulo de autenticação (`js/googleAuth.js`)

```js
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './config.js';

let _tokenClient = null;
let _accessToken = null;

export function initGoogleAuth(onReady) {
  // Carrega a biblioteca GIS (Google Identity Services)
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (resp) => {
        if (resp.access_token) {
          _accessToken = resp.access_token;
          onReady?.(_accessToken);
        }
      },
    });
  };
  document.head.appendChild(script);
}

export function getAccessToken() { return _accessToken; }

export function requestToken() {
  if (_tokenClient) _tokenClient.requestAccessToken();
}
```

#### 3. Módulo de Drive (`js/driveSync.js`)

```js
import { getAccessToken } from './googleAuth.js';
import { DRIVE_FILE_NAME } from './config.js';

const BASE_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

export async function encontrarArquivo() {
  const token = getAccessToken();
  const resp = await fetch(
    `${BASE_URL}?spaces=appDataFolder&q=name='${DRIVE_FILE_NAME}'&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  return data.files?.[0] || null;
}

export async function baixarDrive() {
  const arquivo = await encontrarArquivo();
  if (!arquivo) return null;
  const token = getAccessToken();
  const resp = await fetch(`${BASE_URL}/${arquivo.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}

export async function enviarDrive(dados) {
  const token = getAccessToken();
  const arquivo = await encontrarArquivo();
  const body = JSON.stringify(dados);
  const meta = { name: DRIVE_FILE_NAME, parents: ['appDataFolder'] };

  if (arquivo) {
    // Atualiza arquivo existente
    await fetch(`${UPLOAD_URL}/${arquivo.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });
  } else {
    // Cria arquivo novo
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    await fetch(`${UPLOAD_URL}?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }
}
```

#### 4. Integração no `app.js`

```js
import { initGoogleAuth, requestToken, getAccessToken } from './googleAuth.js';
import { baixarDrive, enviarDrive } from './driveSync.js';
import { db } from './db.js';

// Inicializa Google Auth ao carregar
initGoogleAuth((token) => {
  console.log('Google Auth pronto, token:', token ? 'OK' : 'falhou');
});

// Botão "Conectar ao Drive"
document.getElementById('btn-drive-sync').addEventListener('click', async () => {
  if (!getAccessToken()) {
    requestToken(); // abre popup do Google
    return;
  }
  // Token disponível: sincroniza
  await sincronizarDrive();
});

async function sincronizarDrive() {
  try {
    const dadosDrive = await baixarDrive();
    if (dadosDrive && dadosDrive.items) {
      // Opção: perguntar ao usuário se quer substituir ou mesclar
      db.importJSON(dadosDrive);
      renderViewAtual();
      toast('Dados sincronizados do Google Drive.');
    } else {
      // Drive vazio: envia dados locais
      await enviarDrive(db.exportJSON());
      toast('Dados enviados para o Google Drive.');
    }
  } catch (err) {
    console.error('Erro ao sincronizar:', err);
    toast('Erro ao sincronizar com o Drive.', 'erro');
  }
}
```

### UI necessária

Adicionar um botão no top-nav (desktop) e na aba Gestão (mobile):

```html
<button class="icon-btn" id="btn-drive-sync" title="Sincronizar com Google Drive">
  <svg width="18" height="18" viewBox="0 0 24 24" ...><!-- ícone cloud --></svg>
</button>
```

Estados visuais:
- Cinza: não conectado
- Azul: conectado (mostrar email do usuário como tooltip)
- Spinner durante sincronização

### Estratégia de conflito

Quando Drive e localStorage têm dados diferentes, apresentar ao usuário:
- "Usar dados do Drive (X itens, última atualização: DATA)"
- "Usar dados locais (Y itens, última atualização: DATA)"
- "Mesclar (combina os dois, pode gerar duplicatas)"

### Limitações e cuidados

- **CORS**: A Drive API aceita chamadas direto do browser via `fetch` com o token OAuth. ✓
- **Token expira**: Tokens do GIS têm validade de ~1 hora. Implementar reautenticação silenciosa.
- **Offline**: Se o app estiver offline, manter os dados no localStorage e sincronizar quando reconectar.
- **Privacidade**: O `appDataFolder` é privado — o usuário não vê os arquivos no Google Drive.
- **Quota**: A Drive API tem quota de 1 bilhão de requisições/dia para projetos novos. Suficiente para uso pessoal.

### Ordem de implementação sugerida

1. Criar projeto no Google Cloud Console e obter `Client ID`
2. Implementar `config.js` com o Client ID real
3. Implementar `googleAuth.js` e testar fluxo OAuth (popup → token)
4. Implementar `driveSync.js` com criar/ler/atualizar arquivo
5. Integrar botão de sync no `app.js`
6. Implementar UI de estado (conectado/desconectado/sincronizando)
7. Implementar estratégia de conflito (substituir vs mesclar)
8. Testar em diferentes dispositivos para validar sincronização

---

## Outras evoluções possíveis

### Notificações push (Fase 3)

Usar a **Web Push API** + Service Worker para enviar lembretes de tarefas com hora definida. Requer backend mínimo para enviar as notificações (ou serviço como Firebase Cloud Messaging).

### Edição de ocorrência individual (melhoria de recorrência)

Atualmente editar um item recorrente altera toda a série. Uma melhoria seria permitir editar apenas uma ocorrência específica — criando uma "exceção" salva no item-pai.

### Exportação para Google Calendar

Exportar itens com data/hora para o Google Calendar via API, usando o mesmo fluxo OAuth da integração com Drive.

### Modo colaborativo

Compartilhar um arquivo de backup via Google Drive com outro usuário. Requer lógica de merge mais robusta.

---

> Estas evoluções **não estão implementadas** na Versão 1. Este documento serve de guia para o desenvolvimento futuro.
