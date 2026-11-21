/**
 * FinTrack v4.0 — Cofre Criptográfico Zero-Knowledge (AES-256-GCM + PBKDF2-SHA256)
 *
 * 100% Client-Side | Exclusivamente W3C WebCrypto API (`crypto.subtle` + `crypto.getRandomValues`)
 * Interoperável com envelopes `.vault` da v3.4 (`public/app.html`).
 */

export const VAULT_ITERATIONS = 600_000;
export const MIN_VAULT_PASSWORD_LENGTH = 8;
export const VAULT_SESSION_CONFIG_KEY = 'FINTRACK_VAULT_SESSION_CONFIG';

// Alfabeto Base32 inequívoco (32 caracteres, sem 0, O, 1, I) -> 5 bits por caractere
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_KEY_LENGTH = 24; // 24 * 5 = 120 bits de entropia

export interface AutoLockOption {
  value: number;
  label: string;
}

export const AUTO_LOCK_OPTIONS: readonly AutoLockOption[] = [
  { value: 2, label: '2 minutos' },
  { value: 5, label: '5 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 0, label: 'Nunca bloquear' },
] as const;

export interface VaultSessionConfig {
  enabled: boolean;
  autoLockMin: number;
  updatedAt: string;
}

export interface RecoveryWrappedPayload {
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface VaultEnvelope {
  __vault: true;
  version: '4.0';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  recoveryWrapped?: RecoveryWrappedPayload;
}

export interface LegacyVaultSecurityV34 {
  enabled?: boolean;
  cifrar?: boolean;
  autoLockMin?: number;
  kdfAlgo?: string;
  kdfIters?: number;
  salt?: string;
  hash?: string;
  cifraSalt?: string;
  recoveryHash?: string;
  recoverySalt?: string;
  recoveryKeySalt?: string;
  recoveryEnvelope?: string;
  recoveryEnvelopeIv?: string;
}

export interface LegacyVaultEnvelopeV34 {
  __vault: true;
  version?: string;
  lastUpdated?: string;
  seguranca: LegacyVaultSecurityV34;
  iv: string;
  ciphertext: string;
}

export type PasswordStrengthLevel = 'muito-fraca' | 'fraca' | 'media' | 'forte' | 'muito-forte';

export interface PasswordStrengthResult {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  level: PasswordStrengthLevel;
  feedback: string;
}

function getWebCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c || !c.subtle || typeof c.getRandomValues !== 'function') {
    throw new Error('W3C WebCrypto API indisponível neste ambiente.');
  }
  return c;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function wipeBytes(...buffers: (Uint8Array | null | undefined)[]): void {
  for (const buf of buffers) {
    if (buf instanceof Uint8Array) {
      buf.fill(0);
    }
  }
}

function safeJsonParseNoProto<T>(jsonStr: string): T {
  return JSON.parse(jsonStr, (key, value) =>
    key === '__proto__' || key === 'constructor' || key === 'prototype' ? undefined : value
  ) as T;
}

/**
 * Normaliza uma Recovery Key removendo hífens/espaços e convertendo para maiúsculas.
 */
export function normalizeRecoveryKey(key: string): string {
  return (key || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
}

/**
 * Gera uma Recovery Key de 120 bits de entropia (24 caracteres Base32 sem 0, O, 1, I),
 * formatada em grupos de 4 separados por hífen (`XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`).
 */
export function generateRecoveryKey(): string {
  const webCrypto = getWebCrypto();
  const randomBytes = webCrypto.getRandomValues(new Uint8Array(RECOVERY_KEY_LENGTH));
  let raw = '';
  for (let i = 0; i < randomBytes.length; i++) {
    // 256 é múltiplo exato de 32 -> distribuição uniforme sem viés de módulo
    raw += RECOVERY_ALPHABET[randomBytes[i] % 32];
  }
  wipeBytes(randomBytes);
  return raw.match(/.{1,4}/g)?.join('-') ?? raw;
}

/**
 * Valida o requisito mínimo de comprimento de senha mestra (>= 8 caracteres).
 */
export function validateVaultPassword(password: string): { valid: boolean; reason?: string } {
  if (typeof password !== 'string' || password.length < MIN_VAULT_PASSWORD_LENGTH) {
    return {
      valid: false,
      reason: `A senha mestra deve ter no mínimo ${MIN_VAULT_PASSWORD_LENGTH} caracteres.`,
    };
  }
  return { valid: true };
}

/**
 * Avalia a força da senha mestra para feedback imediato na UI.
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const validation = validateVaultPassword(password);
  if (!validation.valid) {
    return {
      valid: false,
      score: 0,
      level: 'muito-fraca',
      feedback: validation.reason ?? 'Senha inválida.',
    };
  }

  let criteria = 0;
  if (password.length >= 12) criteria += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) criteria += 1;
  if (/\d/.test(password)) criteria += 1;
  if (/[^A-Za-z0-9]/.test(password)) criteria += 1;

  const score = Math.min(4, Math.max(1, criteria)) as 1 | 2 | 3 | 4;
  const levels: Record<1 | 2 | 3 | 4, { level: PasswordStrengthLevel; feedback: string }> = {
    1: { level: 'fraca', feedback: 'Adicione letras maiúsculas, números ou símbolos.' },
    2: { level: 'media', feedback: 'Senha aceitável; 12+ caracteres aumentam a resistência.' },
    3: { level: 'forte', feedback: 'Boa entropia para proteção local com PBKDF2-600k.' },
    4: { level: 'muito-forte', feedback: 'Excelente entropia criptográfica.' },
  };

  return {
    valid: true,
    score,
    level: levels[score].level,
    feedback: levels[score].feedback,
  };
}

/**
 * Deriva uma CryptoKey AES-256-GCM não-extraível via PBKDF2-HMAC-SHA256.
 */
export async function deriveVaultKey(
  password: string,
  saltBytes: Uint8Array,
  iterations = VAULT_ITERATIONS
): Promise<CryptoKey> {
  if (!password || typeof password !== 'string') {
    throw new Error('Segredo inválido para derivação de chave.');
  }
  if (!(saltBytes instanceof Uint8Array) || saltBytes.byteLength < 8) {
    throw new Error('Salt criptográfico inválido.');
  }
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error('Contagem de iterações PBKDF2 inválida.');
  }

  const webCrypto = getWebCrypto();
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const safeSalt = new Uint8Array(new ArrayBuffer(saltBytes.byteLength));
  safeSalt.set(saltBytes);

  try {
    const keyMaterial = await webCrypto.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return await webCrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: safeSalt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // extractable: false -> chave nunca pode ser lida em raw da memória
      ['encrypt', 'decrypt']
    );
  } finally {
    wipeBytes(passwordBytes, safeSalt);
  }
}

async function aesGcmEncrypt(
  key: CryptoKey,
  plaintextBytes: Uint8Array
): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: Uint8Array<ArrayBuffer> }> {
  const webCrypto = getWebCrypto();
  const iv = webCrypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const safePlaintext = new Uint8Array(new ArrayBuffer(plaintextBytes.byteLength));
  safePlaintext.set(plaintextBytes);

  try {
    const encrypted = await webCrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      safePlaintext
    );
    return {
      iv,
      ciphertext: new Uint8Array(encrypted),
    };
  } finally {
    wipeBytes(safePlaintext);
  }
}

async function aesGcmDecrypt(
  key: CryptoKey,
  ciphertextBytes: Uint8Array,
  ivBytes: Uint8Array
): Promise<Uint8Array<ArrayBuffer>> {
  const webCrypto = getWebCrypto();
  const safeIv = new Uint8Array(new ArrayBuffer(ivBytes.byteLength));
  safeIv.set(ivBytes);
  const safeCt = new Uint8Array(new ArrayBuffer(ciphertextBytes.byteLength));
  safeCt.set(ciphertextBytes);

  try {
    const decrypted = await webCrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: safeIv },
      key,
      safeCt
    );
    return new Uint8Array(decrypted);
  } finally {
    wipeBytes(safeIv, safeCt);
  }
}

/**
 * Type guard para envelopes criptográficos `.vault` (v4.0 e legado v3.4).
 */
export function isEncryptedVaultEnvelope(
  obj: unknown
): obj is VaultEnvelope | LegacyVaultEnvelopeV34 {
  if (!obj || typeof obj !== 'object') return false;
  const rec = obj as Record<string, unknown>;
  if (rec.__vault !== true) return false;
  if (typeof rec.iv !== 'string' || rec.iv.length === 0) return false;
  if (typeof rec.ciphertext !== 'string' || rec.ciphertext.length === 0) return false;

  // Formato v4.0
  if (typeof rec.salt === 'string' && rec.salt.length > 0) {
    return true;
  }

  // Formato legado v3.4 (`seguranca.cifraSalt`)
  if (rec.seguranca && typeof rec.seguranca === 'object') {
    const sec = rec.seguranca as Record<string, unknown>;
    return typeof sec.cifraSalt === 'string' && sec.cifraSalt.length > 0;
  }

  return false;
}

/**
 * Cifra qualquer payload JSON serializável em um envelope `.vault` v4.0 (AES-256-GCM + PBKDF2-600k).
 * Se `recoveryKey` for informada, embrulha a senha mestra em `recoveryWrapped` para recuperação zero-knowledge.
 */
export async function encryptVaultPayload(
  data: unknown,
  password: string,
  recoveryKey?: string
): Promise<VaultEnvelope> {
  const pwdCheck = validateVaultPassword(password);
  if (!pwdCheck.valid) {
    throw new Error(pwdCheck.reason);
  }

  const webCrypto = getWebCrypto();
  const encoder = new TextEncoder();
  const salt = webCrypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const plaintextBytes = encoder.encode(JSON.stringify(data));

  let recoverySalt: Uint8Array<ArrayBuffer> | null = null;
  let recoveryPasswordBytes: Uint8Array | null = null;

  try {
    const vaultKey = await deriveVaultKey(password, salt, VAULT_ITERATIONS);
    const { iv, ciphertext } = await aesGcmEncrypt(vaultKey, plaintextBytes);

    const envelope: VaultEnvelope = {
      __vault: true,
      version: '4.0',
      kdf: 'PBKDF2-SHA256',
      iterations: VAULT_ITERATIONS,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
    };

    wipeBytes(iv, ciphertext);

    if (recoveryKey && recoveryKey.trim().length > 0) {
      const normalizedRecovery = normalizeRecoveryKey(recoveryKey);
      if (normalizedRecovery.length !== RECOVERY_KEY_LENGTH) {
        throw new Error('Recovery Key inválida: deve conter exatamente 24 caracteres alfanuméricos.');
      }
      recoverySalt = webCrypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
      const recKey = await deriveVaultKey(normalizedRecovery, recoverySalt, VAULT_ITERATIONS);
      recoveryPasswordBytes = encoder.encode(password);
      const recEncrypted = await aesGcmEncrypt(recKey, recoveryPasswordBytes);

      envelope.recoveryWrapped = {
        kdf: 'PBKDF2-SHA256',
        iterations: VAULT_ITERATIONS,
        salt: bytesToBase64(recoverySalt),
        iv: bytesToBase64(recEncrypted.iv),
        ciphertext: bytesToBase64(recEncrypted.ciphertext),
      };

      wipeBytes(recEncrypted.iv, recEncrypted.ciphertext);
    }

    return envelope;
  } finally {
    wipeBytes(salt, plaintextBytes, recoverySalt, recoveryPasswordBytes);
  }
}

async function decryptV4Envelope<T>(envelope: VaultEnvelope, secret: string): Promise<T> {
  const iterations =
    typeof envelope.iterations === 'number' && envelope.iterations > 0
      ? envelope.iterations
      : VAULT_ITERATIONS;
  const saltBytes = base64ToBytes(envelope.salt);
  const ivBytes = base64ToBytes(envelope.iv);
  const ciphertextBytes = base64ToBytes(envelope.ciphertext);

  try {
    // 1. Tentativa direta com a senha mestra
    try {
      const key = await deriveVaultKey(secret, saltBytes, iterations);
      const pt = await aesGcmDecrypt(key, ciphertextBytes, ivBytes);
      try {
        const jsonStr = new TextDecoder().decode(pt);
        return safeJsonParseNoProto<T>(jsonStr);
      } finally {
        wipeBytes(pt);
      }
    } catch {
      // Continua para tentativa via Recovery Key se disponível
    }

    // 2. Tentativa via Recovery Key embrulhada
    if (envelope.recoveryWrapped) {
      const normRecovery = normalizeRecoveryKey(secret);
      if (normRecovery.length === RECOVERY_KEY_LENGTH) {
        const recIters =
          typeof envelope.recoveryWrapped.iterations === 'number' &&
          envelope.recoveryWrapped.iterations > 0
            ? envelope.recoveryWrapped.iterations
            : iterations;
        const recSalt = base64ToBytes(envelope.recoveryWrapped.salt);
        const recIv = base64ToBytes(envelope.recoveryWrapped.iv);
        const recCt = base64ToBytes(envelope.recoveryWrapped.ciphertext);

        try {
          const recKey = await deriveVaultKey(normRecovery, recSalt, recIters);
          const recoveredPwdBytes = await aesGcmDecrypt(recKey, recCt, recIv);
          try {
            const masterPassword = new TextDecoder().decode(recoveredPwdBytes);
            const vaultKey = await deriveVaultKey(masterPassword, saltBytes, iterations);
            const pt = await aesGcmDecrypt(vaultKey, ciphertextBytes, ivBytes);
            try {
              const jsonStr = new TextDecoder().decode(pt);
              return safeJsonParseNoProto<T>(jsonStr);
            } finally {
              wipeBytes(pt);
            }
          } finally {
            wipeBytes(recoveredPwdBytes);
          }
        } catch {
          // Falha silenciosa para lançar erro genérico unificado abaixo
        } finally {
          wipeBytes(recSalt, recIv, recCt);
        }
      }
    }

    throw new Error('Falha ao decifrar o cofre: credencial incorreta ou dados corrompidos.');
  } finally {
    wipeBytes(saltBytes, ivBytes, ciphertextBytes);
  }
}

async function decryptLegacyV34Envelope<T>(
  envelope: LegacyVaultEnvelopeV34,
  secret: string
): Promise<T> {
  const sec = envelope.seguranca;
  if (!sec || !sec.cifraSalt) {
    throw new Error('Envelope v3.4 inválido: metadados de cifragem ausentes.');
  }

  const iterations =
    typeof sec.kdfIters === 'number' && sec.kdfIters > 0 ? sec.kdfIters : VAULT_ITERATIONS;
  const cifraSaltBytes = base64ToBytes(sec.cifraSalt);
  const ivBytes = base64ToBytes(envelope.iv);
  const ciphertextBytes = base64ToBytes(envelope.ciphertext);

  try {
    // 1. Tentativa direta com senha mestra v3.4
    try {
      const vaultKey = await deriveVaultKey(secret, cifraSaltBytes, iterations);
      const pt = await aesGcmDecrypt(vaultKey, ciphertextBytes, ivBytes);
      try {
        const jsonStr = new TextDecoder().decode(pt);
        return safeJsonParseNoProto<T>(jsonStr);
      } finally {
        wipeBytes(pt);
      }
    } catch {
      // Continua para tentativa via Recovery Key v3.4
    }

    // 2. Tentativa via Recovery Key v3.4
    const recSaltB64 = sec.recoveryKeySalt || sec.recoverySalt;
    if (sec.recoveryEnvelope && sec.recoveryEnvelopeIv && recSaltB64) {
      const normRecovery = normalizeRecoveryKey(secret);
      if (normRecovery.length === RECOVERY_KEY_LENGTH) {
        const recSalt = base64ToBytes(recSaltB64);
        const recIv = base64ToBytes(sec.recoveryEnvelopeIv);
        const recCt = base64ToBytes(sec.recoveryEnvelope);

        try {
          const recKey = await deriveVaultKey(normRecovery, recSalt, iterations);
          const pwdBytes = await aesGcmDecrypt(recKey, recCt, recIv);
          try {
            const masterPassword = new TextDecoder().decode(pwdBytes);
            const vaultKey = await deriveVaultKey(masterPassword, cifraSaltBytes, iterations);
            const pt = await aesGcmDecrypt(vaultKey, ciphertextBytes, ivBytes);
            try {
              const jsonStr = new TextDecoder().decode(pt);
              return safeJsonParseNoProto<T>(jsonStr);
            } finally {
              wipeBytes(pt);
            }
          } finally {
            wipeBytes(pwdBytes);
          }
        } catch {
          // Falha silenciosa para lançar erro genérico unificado abaixo
        } finally {
          wipeBytes(recSalt, recIv, recCt);
        }
      }
    }

    throw new Error('Falha ao decifrar o cofre v3.4: credencial incorreta ou dados corrompidos.');
  } finally {
    wipeBytes(cifraSaltBytes, ivBytes, ciphertextBytes);
  }
}

/**
 * Descriptografa um envelope `.vault` (v4.0 ou legado v3.4) usando senha mestra ou Recovery Key.
 * Nunca vaza dados parciais nem detalhes internos da falha em caso de erro.
 */
export async function decryptVaultPayload<T = unknown>(
  envelope: unknown,
  secret: string
): Promise<T> {
  if (!isEncryptedVaultEnvelope(envelope)) {
    throw new Error('Formato de envelope .vault inválido ou corrompido.');
  }
  if (!secret || typeof secret !== 'string') {
    throw new Error('Credencial inválida para desbloqueio do cofre.');
  }

  const rec = envelope as unknown as Record<string, unknown>;
  if (typeof rec.salt === 'string' && rec.salt.length > 0) {
    return decryptV4Envelope<T>(envelope as VaultEnvelope, secret);
  }

  return decryptLegacyV34Envelope<T>(envelope as LegacyVaultEnvelopeV34, secret);
}

/**
 * Persiste apenas preferências não-sensíveis da sessão do cofre (ex.: auto-lock).
 * Nunca armazena senha, Recovery Key ou CryptoKey.
 */
export function saveVaultSessionConfig(config: {
  enabled: boolean;
  autoLockMin: number;
}): VaultSessionConfig {
  const validValues = new Set(AUTO_LOCK_OPTIONS.map((opt) => opt.value));
  const normalizedAutoLock = validValues.has(config.autoLockMin) ? config.autoLockMin : 15;

  const payload: VaultSessionConfig = {
    enabled: Boolean(config.enabled),
    autoLockMin: normalizedAutoLock,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(VAULT_SESSION_CONFIG_KEY, JSON.stringify(payload));
    }
  } catch {
    // Ignora falhas de quota/modo privado sem interromper o fluxo
  }

  return payload;
}

export function loadVaultSessionConfig(): VaultSessionConfig {
  const fallback: VaultSessionConfig = {
    enabled: false,
    autoLockMin: 15,
    updatedAt: new Date(0).toISOString(),
  };

  try {
    if (typeof globalThis.localStorage === 'undefined') return fallback;
    const raw = globalThis.localStorage.getItem(VAULT_SESSION_CONFIG_KEY);
    if (!raw) return fallback;
    const parsed = safeJsonParseNoProto<Partial<VaultSessionConfig>>(raw);
    return {
      enabled: Boolean(parsed.enabled),
      autoLockMin: typeof parsed.autoLockMin === 'number' ? parsed.autoLockMin : 15,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}
