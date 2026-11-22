import { MAX_NFSE_XML_BYTES } from './taxRtcMath';

export const DEFAULT_LOCAL_RTC_ENDPOINTS = {
  regimeRegular: 'http://localhost:8080',
  simplesNacional: 'http://localhost:8081',
  geradorDanfse: 'http://localhost:8082',
} as const;

export interface LocalRtcHealthResult {
  online: boolean;
  status?: number;
  error?: string;
}

export type DanfsePdfResult =
  | { ok: true; blob: Blob }
  | { ok: false; error: string };

const BLOCKED_URL_ERROR =
  'URL bloqueada por segurança (SSRF): apenas endpoints locais http://localhost ou http://127.0.0.1 são permitidos.';

/**
 * Valida estritamente se a URL aponta para um serviço local HTTP (localhost ou 127.0.0.1).
 * Bloqueia qualquer host externo, credenciais embutidas ou protocolos diferentes de http:.
 */
export function isAllowedLocalRtcUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password) return false;
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Verifica a disponibilidade de uma API local da Receita Federal (RTC/DANFSe)
 * com timeout via AbortController e validação estrita de URL local.
 */
export async function checkLocalRtcHealth(
  baseUrl: string,
  timeoutMs = 3000
): Promise<LocalRtcHealthResult> {
  if (!isAllowedLocalRtcUrl(baseUrl)) {
    return { online: false, error: BLOCKED_URL_ERROR };
  }

  const safeTimeout = Number.isFinite(timeoutMs) ? Math.max(200, Math.min(30000, timeoutMs)) : 3000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safeTimeout);

  try {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    const response = await fetch(normalized, {
      method: 'GET',
      signal: controller.signal,
    });
    const online = response.status >= 200 && response.status < 500;
    return { online, status: response.status };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      online: false,
      error: isAbort
        ? `Tempo limite excedido (${safeTimeout}ms) ao conectar no serviço local.`
        : err instanceof Error
          ? err.message
          : 'Serviço local indisponível.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envia o XML da NFS-e para o serviço local do Gerador DANFSe (Receita Federal)
 * para obtenção do PDF oficial, mantendo bloqueio estrito contra SSRF.
 */
export async function generateOfficialDanfsePdfLocal(
  baseUrl: string,
  xmlText: string,
  timeoutMs = 10000
): Promise<DanfsePdfResult> {
  if (!isAllowedLocalRtcUrl(baseUrl)) {
    return { ok: false, error: BLOCKED_URL_ERROR };
  }

  if (typeof xmlText !== 'string' || !xmlText.trim()) {
    return { ok: false, error: 'XML de NFS-e vazio.' };
  }

  const byteLength = new TextEncoder().encode(xmlText).byteLength;
  if (byteLength > MAX_NFSE_XML_BYTES) {
    return { ok: false, error: 'XML excede o limite máximo permitido de 2 MB.' };
  }

  const safeTimeout = Number.isFinite(timeoutMs)
    ? Math.max(500, Math.min(60000, timeoutMs))
    : 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safeTimeout);

  try {
    const parsed = new URL(baseUrl.trim());
    const endpoint =
      parsed.pathname && parsed.pathname !== '/'
        ? baseUrl.trim()
        : `${baseUrl.trim().replace(/\/+$/, '')}/danfse`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        Accept: 'application/pdf',
      },
      body: xmlText,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Serviço DANFSe local retornou HTTP ${response.status}.`,
      };
    }

    const blob = await response.blob();
    return { ok: true, blob };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      error: isAbort
        ? `Tempo limite excedido (${safeTimeout}ms) ao gerar DANFSe.`
        : err instanceof Error
          ? err.message
          : 'Erro ao comunicar com o gerador DANFSe local.',
    };
  } finally {
    clearTimeout(timer);
  }
}
