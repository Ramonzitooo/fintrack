import { sanitizeNfseXmlForLocalService } from './taxRtcMath';

export const DEFAULT_LOCAL_RTC_ENDPOINTS = {
  regimeRegular: 'http://localhost:8080',
  simplesNacional: 'http://localhost:8081',
  geradorDanfse: 'http://localhost:8082',
} as const;

export const MAX_DANFSE_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_LOCAL_RTC_PORT = 1024;

const MAX_LOCAL_RTC_PORT = 65535;
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // %PDF-

export interface LocalRtcHealthResult {
  online: boolean;
  status?: number;
  error?: string;
}

export type DanfsePdfResult =
  | { ok: true; blob: Blob }
  | { ok: false; error: string };

const BLOCKED_URL_ERROR =
  'URL bloqueada por segurança (SSRF): apenas endpoints locais http://localhost ou http://127.0.0.1 com porta explícita (>= 1024) são permitidos.';

/**
 * Valida estritamente se a URL aponta para um serviço local HTTP (localhost ou 127.0.0.1)
 * com porta explícita não privilegiada (1024..65535), sem query/hash, credenciais ou path traversal.
 */
export function isAllowedLocalRtcUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // Bloqueia caracteres de controle, barra invertida, query/hash brutos e path traversal antes da normalização do parser URL
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f\\?#]/.test(trimmed)) return false;
  if (trimmed.includes('..') || /%2e/i.test(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return false;
    if (parsed.search !== '' || parsed.hash !== '') return false;
    if (
      parsed.pathname.startsWith('//') ||
      parsed.pathname.includes('..') ||
      /%2e/i.test(parsed.pathname)
    ) {
      return false;
    }

    // Porta explícita obrigatória e não privilegiada (porta 80 padrão HTTP resulta em parsed.port === '')
    if (!parsed.port || !/^\d+$/.test(parsed.port)) return false;
    const portNum = Number(parsed.port);
    if (!Number.isInteger(portNum) || portNum < MIN_LOCAL_RTC_PORT || portNum > MAX_LOCAL_RTC_PORT) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica se os primeiros 5 bytes correspondem à assinatura mágica de PDF (%PDF-).
 */
export function isPdfMagicBytes(bytes: Uint8Array): boolean {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < PDF_MAGIC_BYTES.length) {
    return false;
  }
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (bytes[i] !== PDF_MAGIC_BYTES[i]) {
      return false;
    }
  }
  return true;
}

async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number
): Promise<{ ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false; error: string }> {
  const limitMb = Math.round(maxBytes / (1024 * 1024));
  const limitError = `Resposta do serviço DANFSe excede o limite máximo permitido de ${limitMb} MB.`;

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try {
            await reader.cancel();
          } catch {
            // Stream já encerrado ou cancelado
          }
          return { ok: false, error: limitError };
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const combined = new Uint8Array(new ArrayBuffer(totalBytes));
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, bytes: combined };
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    return { ok: false, error: limitError };
  }
  return { ok: true, bytes: new Uint8Array(buffer) };
}

/**
 * Verifica a disponibilidade de uma API local da Receita Federal (RTC/DANFSe)
 * com timeout via AbortController, bloqueio de redirects e validação estrita de URL local.
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
    const parsed = new URL(baseUrl.trim());
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    let endpoint: string;
    if (!normalizedPath || normalizedPath === '/') {
      endpoint = parsed.origin;
    } else {
      const target = new URL(parsed.origin);
      target.pathname = normalizedPath;
      endpoint = target.toString();
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      redirect: 'error',
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
 * Envia o XML da NFS-e higienizado para o serviço local do Gerador DANFSe (Receita Federal)
 * para obtenção do PDF oficial, com bloqueio contra SSRF, redirects, payloads > 10 MB e respostas não-PDF.
 */
export async function generateOfficialDanfsePdfLocal(
  baseUrl: string,
  xmlText: string,
  timeoutMs = 10000
): Promise<DanfsePdfResult> {
  if (!isAllowedLocalRtcUrl(baseUrl)) {
    return { ok: false, error: BLOCKED_URL_ERROR };
  }

  const sanitizedXml = sanitizeNfseXmlForLocalService(xmlText);
  if (!sanitizedXml.ok) {
    return { ok: false, error: sanitizedXml.error };
  }

  const safeTimeout = Number.isFinite(timeoutMs)
    ? Math.max(500, Math.min(60000, timeoutMs))
    : 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safeTimeout);

  try {
    const parsed = new URL(baseUrl.trim());
    let endpoint: string;
    if (parsed.pathname === '/') {
      endpoint = new URL('/danfse', parsed.origin).toString();
    } else {
      const target = new URL(parsed.origin);
      target.pathname = parsed.pathname;
      endpoint = target.toString();
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        Accept: 'application/pdf',
      },
      body: sanitizedXml.xml,
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Serviço DANFSe local retornou HTTP ${response.status}.`,
      };
    }

    const contentLengthHeader = response.headers?.get('content-length');
    if (contentLengthHeader !== null && contentLengthHeader !== undefined) {
      const declaredLength = Number(contentLengthHeader.trim());
      if (Number.isFinite(declaredLength) && declaredLength > MAX_DANFSE_PDF_BYTES) {
        if (response.body) {
          try {
            await response.body.cancel();
          } catch {
            // Stream já encerrado ou cancelado
          }
        }
        return {
          ok: false,
          error: `Resposta do serviço DANFSe excede o limite máximo permitido de ${Math.round(MAX_DANFSE_PDF_BYTES / (1024 * 1024))} MB.`,
        };
      }
    }

    const payloadResult = await readResponseBytesWithLimit(response, MAX_DANFSE_PDF_BYTES);
    if (!payloadResult.ok) {
      return payloadResult;
    }

    if (!isPdfMagicBytes(payloadResult.bytes)) {
      return {
        ok: false,
        error: 'Resposta inválida do serviço DANFSe local: assinatura mágica %PDF- ausente.',
      };
    }

    return {
      ok: true,
      blob: new Blob([payloadResult.bytes], { type: 'application/pdf' }),
    };
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
