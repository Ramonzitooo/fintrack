import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_LOCK_OPTIONS,
  VAULT_ITERATIONS,
  deriveVaultKey,
  generateRecoveryKey,
  normalizeRecoveryKey,
  validateVaultPassword,
  evaluatePasswordStrength,
  encryptVaultPayload,
  decryptVaultPayload,
  isEncryptedVaultEnvelope,
  saveVaultSessionConfig,
  loadVaultSessionConfig,
  type LegacyVaultEnvelopeV34,
} from './cryptoVault.ts';
import { DEFAULT_STATE, type AppState } from './storage.ts';

function buildSampleAppState(): AppState {
  return {
    ...DEFAULT_STATE,
    competenciaAtual: '2026-11',
    salario: {
      proventos: [{ id: 'p1', nome: 'Salário Base', valor: 8500 }],
      descontos: [{ id: 'd1', nome: 'INSS + IRRF', valor: 1500 }],
      bruto: 8500,
      descontosTotal: 1500,
      liquido: 7000,
    },
    bancos: [
      {
        id: 'b1',
        nome: 'Nubank',
        tipo: 'Conta Digital',
        saldo: 4250.75,
        rendeJuros: true,
        pctCDI: 100,
      },
    ],
    caixinhas: [
      {
        id: 'c1',
        nome: 'Reserva de Emergência',
        tipo: 'emergencia',
        saldo: 18000,
        meta: 24000,
        aporteMensal: 1000,
        instituicao: 'Nubank',
      },
    ],
    despesasPorMes: {
      '2026-11': [
        {
          id: 'e1',
          moldeId: null,
          descricao: 'Aluguel',
          valor: 2100,
          diaVencimento: 10,
          paga: true,
          categoria: 'Moradia',
          dataPagamento: '2026-11-10',
          contaOrigem: 'Nubank',
        },
      ],
    },
  };
}

test('generateRecoveryKey produces 24-char unambiguous base32 key grouped in 4s', () => {
  const key = generateRecoveryKey();
  assert.match(key, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){5}$/);
  assert.equal(normalizeRecoveryKey(key).length, 24);
  assert.equal(/[0O1I]/.test(key), false);
});

test('deriveVaultKey returns non-extractable AES-256-GCM CryptoKey', async () => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey('SenhaForte#2026', salt);
  assert.equal(key.type, 'secret');
  assert.equal(key.extractable, false);
  assert.deepEqual(key.algorithm, { name: 'AES-GCM', length: 256 });
  assert.ok(key.usages.includes('encrypt'));
  assert.ok(key.usages.includes('decrypt'));
});

test('password validation and strength helper reject < 8 chars', async () => {
  const shortResult = validateVaultPassword('1234567');
  assert.equal(shortResult.valid, false);

  const strengthShort = evaluatePasswordStrength('Ab1!567');
  assert.equal(strengthShort.valid, false);
  assert.equal(strengthShort.score, 0);

  const strengthStrong = evaluatePasswordStrength('Soberania@2026!');
  assert.equal(strengthStrong.valid, true);
  assert.ok(strengthStrong.score >= 3);

  await assert.rejects(
    () => encryptVaultPayload({ ok: true }, 'curta'),
    /mínimo 8 caracteres/i
  );
});

test('encryptVaultPayload and decryptVaultPayload round-trip full AppState', async () => {
  const state = buildSampleAppState();
  const password = 'CofreFinTrack#2026';

  const envelope = await encryptVaultPayload(state, password);

  assert.equal(envelope.__vault, true);
  assert.equal(envelope.version, '4.0');
  assert.equal(envelope.kdf, 'PBKDF2-SHA256');
  assert.equal(envelope.iterations, VAULT_ITERATIONS);
  assert.equal(isEncryptedVaultEnvelope(envelope), true);

  // Garante que nenhum dado sensível aparece em texto claro no envelope
  const serialized = JSON.stringify(envelope);
  assert.equal(serialized.includes('Nubank'), false);
  assert.equal(serialized.includes('4250.75'), false);

  const decrypted = await decryptVaultPayload<AppState>(envelope, password);
  assert.deepEqual(decrypted, state);
});

test('decryptVaultPayload rejects wrong password without leaking data', async () => {
  const state = buildSampleAppState();
  const envelope = await encryptVaultPayload(state, 'SenhaCorreta@2026');

  await assert.rejects(
    () => decryptVaultPayload(envelope, 'SenhaErrada@2026'),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message.includes('Nubank'), false);
      assert.equal(err.message.includes('4250'), false);
      return true;
    }
  );
});

test('decryptVaultPayload unlocks via Recovery Key and rejects wrong Recovery Key', async () => {
  const state = buildSampleAppState();
  const password = 'SenhaMestra#2026';
  const recoveryKey = generateRecoveryKey();

  const envelope = await encryptVaultPayload(state, password, recoveryKey);
  assert.ok(envelope.recoveryWrapped);

  // Desbloqueio com Recovery Key formatada
  const unlockedFormatted = await decryptVaultPayload<AppState>(envelope, recoveryKey);
  assert.deepEqual(unlockedFormatted, state);

  // Desbloqueio com Recovery Key sem hífens e em minúsculas
  const unformatted = normalizeRecoveryKey(recoveryKey).toLowerCase();
  const unlockedUnformatted = await decryptVaultPayload<AppState>(envelope, unformatted);
  assert.deepEqual(unlockedUnformatted, state);

  // Rejeição de Recovery Key incorreta
  const wrongRecoveryKey = generateRecoveryKey();
  await assert.rejects(
    () => decryptVaultPayload(envelope, wrongRecoveryKey),
    /falha ao decifrar/i
  );
});

test('decryptVaultPayload supports legacy v3.4 .vault envelopes', async () => {
  const legacyPassword = 'v34Password!';
  const cifraSalt = crypto.getRandomValues(new Uint8Array(16));
  const legacyKey = await deriveVaultKey(legacyPassword, cifraSalt, VAULT_ITERATIONS);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const state = buildSampleAppState();
  const plaintext = new TextEncoder().encode(JSON.stringify(state));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, legacyKey, plaintext)
  );

  const toB64 = (u8: Uint8Array) => {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  };

  const legacyEnvelope: LegacyVaultEnvelopeV34 = {
    __vault: true,
    version: '2.0',
    lastUpdated: '2026-11-21T00:00:00.000Z',
    seguranca: {
      enabled: true,
      cifrar: true,
      autoLockMin: 15,
      kdfAlgo: 'pbkdf2',
      kdfIters: VAULT_ITERATIONS,
      cifraSalt: toB64(cifraSalt),
    },
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  };

  assert.equal(isEncryptedVaultEnvelope(legacyEnvelope), true);
  const decrypted = await decryptVaultPayload<AppState>(legacyEnvelope, legacyPassword);
  assert.deepEqual(decrypted, state);

  await assert.rejects(() => decryptVaultPayload(legacyEnvelope, 'wrong-password'));
});

test('isEncryptedVaultEnvelope validates envelope shapes strictly', () => {
  assert.equal(isEncryptedVaultEnvelope(null), false);
  assert.equal(isEncryptedVaultEnvelope('string'), false);
  assert.equal(isEncryptedVaultEnvelope({}), false);
  assert.equal(isEncryptedVaultEnvelope({ __vault: false, iv: 'a', ciphertext: 'b', salt: 'c' }), false);
  assert.equal(isEncryptedVaultEnvelope({ __vault: true, iv: '', ciphertext: 'b', salt: 'c' }), false);
  assert.equal(isEncryptedVaultEnvelope({ __vault: true, iv: 'a', ciphertext: 'b' }), false);
  assert.equal(
    isEncryptedVaultEnvelope({ __vault: true, iv: 'a', ciphertext: 'b', salt: 'c' }),
    true
  );
  assert.equal(
    isEncryptedVaultEnvelope({
      __vault: true,
      iv: 'a',
      ciphertext: 'b',
      seguranca: { cifraSalt: 'c' },
    }),
    true
  );
});

test('AUTO_LOCK_OPTIONS and saveVaultSessionConfig handle non-sensitive session preferences', () => {
  assert.ok(AUTO_LOCK_OPTIONS.some((opt) => opt.value === 15));
  const saved = saveVaultSessionConfig({ enabled: true, autoLockMin: 30 });
  assert.equal(saved.enabled, true);
  assert.equal(saved.autoLockMin, 30);

  const loadedFallback = loadVaultSessionConfig();
  assert.equal(typeof loadedFallback.autoLockMin, 'number');
});
