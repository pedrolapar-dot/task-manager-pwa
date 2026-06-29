import { getToken, requestToken } from './googleAuth.js';
import { DRIVE_FILE_NAME } from './config.js';

const FILES_API  = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// Retorna os headers Authorization, renovando token se necessário.
async function authHeaders() {
  let token = getToken();
  if (!token) token = await requestToken();
  return { Authorization: `Bearer ${token}` };
}

// Procura o arquivo de dados no appDataFolder. Retorna { id, modifiedTime } ou null.
export async function buscarArquivo() {
  const h   = await authHeaders();
  const q   = encodeURIComponent(`name='${DRIVE_FILE_NAME}'`);
  const url = `${FILES_API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)`;
  const resp = await fetch(url, { headers: h });
  if (!resp.ok) throw new Error(`Drive busca: HTTP ${resp.status}`);
  const data = await resp.json();
  return data.files?.[0] ?? null;
}

// Baixa o conteúdo do arquivo. Retorna { payload, fileId } ou null se não existir.
export async function baixar() {
  const file = await buscarArquivo();
  if (!file) return null;

  const h    = await authHeaders();
  const resp = await fetch(`${FILES_API}/${file.id}?alt=media`, { headers: h });
  if (!resp.ok) throw new Error(`Drive download: HTTP ${resp.status}`);

  return { payload: await resp.json(), fileId: file.id };
}

// Envia o payload para o Drive.
// Se fileId fornecido: atualiza (PATCH). Caso contrário: cria novo no appDataFolder.
// Retorna o fileId (novo ou existente).
export async function enviar(payload, fileId = null) {
  const h    = await authHeaders();
  const body = JSON.stringify(payload);

  if (fileId) {
    const resp = await fetch(`${UPLOAD_API}/${fileId}?uploadType=media`, {
      method:  'PATCH',
      headers: { ...h, 'Content-Type': 'application/json' },
      body,
    });
    if (!resp.ok) throw new Error(`Drive upload: HTTP ${resp.status}`);
    return fileId;
  }

  // Cria arquivo novo com metadados (multipart)
  const meta = JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] });
  const sep  = 'tm_pwa_boundary';
  const multi = [
    `--${sep}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    meta,
    `--${sep}`,
    'Content-Type: application/json',
    '',
    body,
    `--${sep}--`,
  ].join('\r\n');

  const resp = await fetch(`${UPLOAD_API}?uploadType=multipart`, {
    method:  'POST',
    headers: { ...h, 'Content-Type': `multipart/related; boundary="${sep}"` },
    body:    multi,
  });
  if (!resp.ok) throw new Error(`Drive criar: HTTP ${resp.status}`);
  const criado = await resp.json();
  return criado.id;
}
