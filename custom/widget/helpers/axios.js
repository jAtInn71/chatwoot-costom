import axios from 'axios';
import { APP_BASE_URL } from 'widget/helpers/constants';

export const API = axios.create({
  baseURL: APP_BASE_URL,
  withCredentials: false,
});

export const setHeader = (value, key = 'X-Auth-Token') => {
  API.defaults.headers.common[key] = value;
};

export const removeHeader = key => {
  delete API.defaults.headers.common[key];
};

// ─── WEBSITE TOKEN ────────────────────────────────────────────────────────────
// The widget iframe URL always contains ?website_token=xxx when first loaded
// by the SDK. We capture it immediately here — at module load time — into a
// module-level constant so that it is NEVER affected by later calls to
// window.history.replaceState() (which can strip URL params during exit-chat).
//
// Why a module constant and not window.location.search at call time?
// Because clearCurrentUser() calls history.replaceState to clean up session
// params from the URL. If website_token were stripped there (old bug), or if
// any future code replaces the URL, reading window.location.search at
// request-time would give us an empty/missing token → 404 from the server.
//
// By reading it once at startup and storing it here, the token is always
// available for the lifetime of the iframe regardless of URL changes.
// ─────────────────────────────────────────────────────────────────────────────
const _captureWebsiteToken = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('website_token') || '';
  } catch (_) {
    return '';
  }
};

export const WEBSITE_TOKEN = _captureWebsiteToken();