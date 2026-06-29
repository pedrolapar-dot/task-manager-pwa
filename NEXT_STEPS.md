# Próximas Evoluções — Task Manager PWA

---

## Fase 2 — Google Drive Sync ✅ IMPLEMENTADA

A sincronização com Google Drive está completa. Para ativar, basta configurar o Client ID.

### Como configurar o Google Drive Sync

#### 1. Criar projeto no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/)
2. Crie um projeto novo (ex: "Task Manager PWA")
3. Ative a **Google Drive API**: Biblioteca → busque "Google Drive API" → Ativar
4. Vá em **Credenciais** → Criar credenciais → **ID do cliente OAuth 2.0**
5. Tipo de aplicativo: **Aplicativo da Web**
6. Em **Origens JavaScript autorizadas**, adicione:
   - `http://localhost:8787`
   - `https://pedrolapar-dot.github.io`
7. Copie o **Client ID** gerado (formato: `XXXXXXXX.apps.googleusercontent.com`)

#### 2. Colar o Client ID no app

Abra o arquivo `js/config.js` e substitua o placeholder:

```js
// Antes:
export const GOOGLE_CLIENT_ID = "COLE_AQUI_SEU_CLIENT_ID";

// Depois:
export const GOOGLE_CLIENT_ID = "SEU_CLIENT_ID_REAL.apps.googleusercontent.com";
```

**Importante:** nunca commite o Client ID em repositório público. Adicione `js/config.js` ao `.gitignore` se quiser manter apenas para uso local. O Client ID de OAuth 2.0 de aplicativo web não é secreto (fica visível no HTML) mas identificar o projeto é suficiente para manter em `.gitignore` como boa prática.

#### 3. Testar localmente

```bash
cd task-manager-pwa
python3 -m http.server 8787
```

Abra `http://localhost:8787/` — o botão "Conectar Drive" aparecerá no topo (desktop) ou embaixo da barra de busca (mobile).

#### 4. Publicar atualização no GitHub Pages

```bash
# De dentro da pasta task-manager-pwa (já inicializada com git):
git add .
git commit -m "feat: google drive sync"
git push
```

GitHub Pages publica automaticamente. URL: `https://pedrolapar-dot.github.io/task-manager-pwa/`

---

### Fluxo de uso do Drive Sync

1. Clique **"Conectar Drive"** — abre popup do Google para autorizar
2. Autorize o acesso ao `appDataFolder` (pasta privada do app, invisível no Drive)
3. Na **primeira conexão**:
   - Se não há arquivo no Drive → seus dados locais são enviados
   - Se já há arquivo → app pergunta qual versão usar (Drive ou local)
4. **Após conectado**: qualquer criação/edição/exclusão dispara sync automático em 3 segundos
5. **Botão de sync manual**: clique no status "Drive conectado" para forçar sincronização
6. Em sessões futuras: clique "Reconectar Drive" (não há popup se você já autorizou antes)

### Dados armazenados no Drive

Arquivo `task-manager-data.json` no `appDataFolder` (privado, invisível ao usuário):

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-06-29T12:00:00.000Z",
  "deviceId": "uuid-do-dispositivo",
  "items": [...]
}
```

### Resolução de conflito

Se tanto o Drive quanto o dispositivo local têm dados modificados desde a última sincronização, o app exibe um modal com:
- **Usar dados do Drive** — X itens, data/hora da última modificação
- **Manter dados locais** — Y itens, data/hora da última modificação
- **Cancelar** — continua sem sincronizar

---

## Outras evoluções possíveis

### Notificações push (Fase 3)

Usar a **Web Push API** + Service Worker para enviar lembretes de tarefas com hora definida. Requer backend mínimo para enviar as notificações (ou Firebase Cloud Messaging).

### Edição de ocorrência individual

Atualmente editar um item recorrente altera toda a série. Uma melhoria seria permitir editar apenas uma ocorrência específica — criando uma "exceção" salva no item-pai.

### Exportação para Google Calendar

Exportar itens com data/hora para o Google Calendar via API, usando o mesmo fluxo OAuth da integração com Drive.

---

> Para rodar localmente: `cd task-manager-pwa && python3 -m http.server 8787` → `http://localhost:8787/`
> GitHub Pages: `https://pedrolapar-dot.github.io/task-manager-pwa/`
