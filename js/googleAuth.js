import { GOOGLE_CLIENT_ID, DRIVE_SCOPE } from './config.js';

// Retorna true se o CLIENT_ID foi configurado (não é o placeholder)
export function isDriveEnabled() {
  return typeof GOOGLE_CLIENT_ID === 'string' &&
         GOOGLE_CLIENT_ID.length > 20 &&
         !GOOGLE_CLIENT_ID.startsWith('COLE');
}

let _tokenClient  = null;
let _accessToken  = null;
let _tokenExpiry  = 0;

// Carrega a biblioteca Google Identity Services e prepara o token client.
// Resolve true se OK, false se CLIENT_ID ausente ou falha de rede.
export function initAuth() {
  return new Promise((resolve) => {
    if (!isDriveEnabled()) { resolve(false); return; }

    if (window.google?.accounts?.oauth2) {
      _criarTokenClient();
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src   = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload  = () => { _criarTokenClient(); resolve(true); };
    script.onerror = () => resolve(false); // sem rede — degradar silenciosamente
    document.head.appendChild(script);
  });
}

function _criarTokenClient() {
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope:     DRIVE_SCOPE,
    callback:  () => {}, // sobrescrito em requestToken()
  });
}

// Retorna o token atual se ainda válido, null caso contrário.
export function getToken() {
  return (_accessToken && Date.now() < _tokenExpiry) ? _accessToken : null;
}

// Solicita um novo token de acesso (abre popup do Google se necessário).
// prompt: '' = usa sessão existente se possível | 'consent' = força tela de consentimento
export function requestToken(prompt = '') {
  return new Promise((resolve, reject) => {
    if (!_tokenClient) { reject(new Error('Auth não inicializado')); return; }
    _tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error_description || resp.error));
        return;
      }
      _accessToken  = resp.access_token;
      _tokenExpiry  = Date.now() + ((resp.expires_in ?? 3599) - 60) * 1000;
      resolve(_accessToken);
    };
    _tokenClient.requestAccessToken({ prompt });
  });
}

// Revoga o token e limpa o estado local.
export function revokeToken() {
  if (_accessToken) {
    window.google?.accounts?.oauth2?.revoke(_accessToken, () => {});
  }
  _accessToken = null;
  _tokenExpiry = 0;
}
