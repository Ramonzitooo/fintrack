import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_LOCK_OPTIONS,
  VAULT_ITERATIONS,
  MIN_KDF_ITERATIONS,
  MAX_KDF_ITERATIONS,
  VAULT_LOCKOUT_STORAGE_KEY,
  MAX_FREE_UNLOCK_ATTEMPTS,
  deriveVaultKey,
  generateRecoveryKey,
  normalizeRecoveryKey,
  validateVaultPassword,
  evaluatePasswordStrength,
  encryptVaultPayload,
  decryptVaultPayload,
  createVaultSession,
  unlockVaultWithSession,
  encryptWithVaultSession,
  isEncryptedVaultEnvelope,
  saveVaultSessionConfig,
  loadVaultSessionConfig,
  getVaultUnlockLockoutState,
  recordFailedVaultUnlock,
  resetVaultUnlockLockout,
  rotateVaultMasterPassword,
  type VaultEnvelope,
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

test('CRÍTICO-01: unlock via Recovery Key (lowercase/no hyphens), re-save with encryptWithVaultSession, and unlock via Master Password and canonical Recovery Key', async () => {
  // Arrange
  const state1 = buildSampleAppState();
  const masterPassword = 'SenhaMestraOriginal#2026';
  const recoveryKey = generateRecoveryKey();
  const unformattedRecovery = normalizeRecoveryKey(recoveryKey).toLowerCase();

  const { envelope: env1, session: initialSession } = await createVaultSession(
    state1,
    masterPassword,
    recoveryKey
  );
  assert.equal(initialSession.vaultKey.extractable, false);

  // Act — desbloqueia com Recovery Key em minúsculas e sem hífens
  const unlockedViaRec = await unlockVaultWithSession<AppState>(env1, unformattedRecovery);
  assert.equal(unlockedViaRec.unlockedViaRecovery, true);
  assert.equal(unlockedViaRec.migratedFromLegacy, false);
  assert.equal(unlockedViaRec.session.vaultKey.extractable, false);
  assert.deepEqual(unlockedViaRec.data, state1);

  // Salva alteração usando apenas a sessão (CryptoKey inextratível)
  const state2: AppState = {
    ...state1,
    bancos: [{ ...state1.bancos[0], saldo: 9876.54 }],
  };
  const env2 = await encryptWithVaultSession(state2, unlockedViaRec.session);

  // Assert — novo envelope mantém salt/recoveryWrapped e gera IV novo
  assert.notEqual(env2.iv, env1.iv);
  assert.equal(env2.salt, env1.salt);
  assert.ok(env2.recoveryWrapped);

  // Deve desbloquear com a Senha Mestra original (prova de que CRÍTICO-01 foi eliminado)
  const unlockedWithPwd = await unlockVaultWithSession<AppState>(env2, masterPassword);
  assert.equal(unlockedWithPwd.unlockedViaRecovery, false);
  assert.equal(unlockedWithPwd.migratedFromLegacy, false);
  assert.deepEqual(unlockedWithPwd.data, state2);

  // Deve continuar desbloqueando com a Recovery Key canônica
  const unlockedWithCanonicalRec = await unlockVaultWithSession<AppState>(env2, recoveryKey);
  assert.equal(unlockedWithCanonicalRec.unlockedViaRecovery, true);
  assert.equal(unlockedWithCanonicalRec.migratedFromLegacy, false);
  assert.deepEqual(unlockedWithCanonicalRec.data, state2);
});

test('Legacy v3.4: unlock via Recovery Key migrates to v4.0 preserving unlock by Master Password and Recovery Key', async () => {
  // Arrange — constrói um envelope legado v3.4 completo com recoveryEnvelope
  const legacyPassword = 'v34LegacyPassword#2026';
  const recoveryKey = generateRecoveryKey();
  const normRecovery = normalizeRecoveryKey(recoveryKey);
  const cifraSalt = crypto.getRandomValues(new Uint8Array(16));
  const recoveryKeySalt = crypto.getRandomValues(new Uint8Array(16));
  const state1 = buildSampleAppState();

  const legacyVaultKey = await deriveVaultKey(legacyPassword, cifraSalt, VAULT_ITERATIONS);
  const dataIv = crypto.getRandomValues(new Uint8Array(12));
  const dataCt = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: dataIv },
      legacyVaultKey,
      new TextEncoder().encode(JSON.stringify(state1))
    )
  );

  const recKey = await deriveVaultKey(normRecovery, recoveryKeySalt, VAULT_ITERATIONS);
  const recIv = crypto.getRandomValues(new Uint8Array(12));
  const recCt = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: recIv },
      recKey,
      new TextEncoder().encode(legacyPassword)
    )
  );

  const toB64 = (u8: Uint8Array) => {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  };

  const legacyEnvelope: LegacyVaultEnvelopeV34 = {
    __vault: true,
    version: '3.4',
    lastUpdated: '2026-11-21T00:00:00.000Z',
    seguranca: {
      enabled: true,
      cifrar: true,
      autoLockMin: 15,
      kdfAlgo: 'pbkdf2',
      kdfIters: VAULT_ITERATIONS,
      cifraSalt: toB64(cifraSalt),
      recoveryKeySalt: toB64(recoveryKeySalt),
      recoveryEnvelope: toB64(recCt),
      recoveryEnvelopeIv: toB64(recIv),
    },
    iv: toB64(dataIv),
    ciphertext: toB64(dataCt),
  };

  // Act — desbloqueia v3.4 via Recovery Key em minúsculas sem hífens
  const migrated = await unlockVaultWithSession<AppState>(
    legacyEnvelope,
    normRecovery.toLowerCase()
  );

  // Assert — sessão migrada usa novo salt, CryptoKey inextratível e re-embrulha masterPassword
  assert.equal(migrated.unlockedViaRecovery, true);
  assert.equal(migrated.migratedFromLegacy, true);
  assert.equal(migrated.session.vaultKey.extractable, false);
  assert.notEqual(migrated.session.salt, legacyEnvelope.seguranca.cifraSalt);
  assert.ok(migrated.session.recoveryWrapped);
  assert.deepEqual(migrated.data, state1);

  const state2: AppState = {
    ...state1,
    bancos: [{ ...state1.bancos[0], saldo: 12345.67 }],
  };
  const v4Envelope = await encryptWithVaultSession(state2, migrated.session);
  assert.equal(v4Envelope.version, '4.0');

  // Re-desbloqueio do envelope migrado pela Senha Mestra original
  const reopenedByPwd = await unlockVaultWithSession<AppState>(v4Envelope, legacyPassword);
  assert.equal(reopenedByPwd.migratedFromLegacy, false);
  assert.equal(reopenedByPwd.unlockedViaRecovery, false);
  assert.deepEqual(reopenedByPwd.data, state2);

  // Re-desbloqueio do envelope migrado pela Recovery Key canônica
  const reopenedByRec = await unlockVaultWithSession<AppState>(v4Envelope, recoveryKey);
  assert.equal(reopenedByRec.migratedFromLegacy, false);
  assert.equal(reopenedByRec.unlockedViaRecovery, true);
  assert.deepEqual(reopenedByRec.data, state2);

  // Também garante migração via Senha Mestra preservando recoveryWrapped legado
  const migratedByPwd = await unlockVaultWithSession<AppState>(legacyEnvelope, legacyPassword);
  assert.equal(migratedByPwd.migratedFromLegacy, true);
  assert.equal(migratedByPwd.unlockedViaRecovery, false);
  const v4FromPwd = await encryptWithVaultSession(state2, migratedByPwd.session);
  assert.deepEqual(await decryptVaultPayload<AppState>(v4FromPwd, legacyPassword), state2);
  assert.deepEqual(await decryptVaultPayload<AppState>(v4FromPwd, recoveryKey), state2);
});

test('MÉDIO-02: rejects KDF iterations outside [MIN_KDF_ITERATIONS, MAX_KDF_ITERATIONS] in v4.0, recoveryWrapped, v3.4 and deriveVaultKey', async () => {
  assert.equal(MIN_KDF_ITERATIONS, 100_000);
  assert.equal(MAX_KDF_ITERATIONS, 2_000_000);

  const state = buildSampleAppState();
  const password = 'SenhaValida#2026';
  const recoveryKey = generateRecoveryKey();
  const validEnv = await encryptVaultPayload(state, password, recoveryKey);

  // v4.0 abaixo do mínimo (1000) e acima do máximo (2_000_000_000 -> bloqueio anti-DoS)
  const lowIterEnv: VaultEnvelope = { ...validEnv, iterations: 1000 };
  const dosIterEnv: VaultEnvelope = { ...validEnv, iterations: 2_000_000_000 };
  const zeroIterEnv: VaultEnvelope = { ...validEnv, iterations: 0 };
  const floatIterEnv: VaultEnvelope = { ...validEnv, iterations: 100_000.5 };
  const dosRecIterEnv: VaultEnvelope = {
    ...validEnv,
    recoveryWrapped: { ...validEnv.recoveryWrapped!, iterations: 2_000_000_000 },
  };

  await assert.rejects(() => decryptVaultPayload(lowIterEnv, password), /iterações/i);
  await assert.rejects(() => decryptVaultPayload(dosIterEnv, password), /iterações/i);
  await assert.rejects(() => unlockVaultWithSession(lowIterEnv, password), /iterações/i);
  await assert.rejects(() => unlockVaultWithSession(dosIterEnv, password), /iterações/i);
  await assert.rejects(() => unlockVaultWithSession(zeroIterEnv, password), /iterações/i);
  await assert.rejects(() => unlockVaultWithSession(floatIterEnv, password), /iterações/i);
  await assert.rejects(() => unlockVaultWithSession(dosRecIterEnv, password), /iterações/i);

  // Legado v3.4 fora do intervalo permitido
  const legacyBase: LegacyVaultEnvelopeV34 = {
    __vault: true,
    version: '3.4',
    seguranca: {
      cifraSalt: validEnv.salt,
      kdfIters: 1000,
    },
    iv: validEnv.iv,
    ciphertext: validEnv.ciphertext,
  };
  await assert.rejects(() => decryptVaultPayload(legacyBase, password), /iterações/i);
  await assert.rejects(
    () =>
      unlockVaultWithSession(
        { ...legacyBase, seguranca: { ...legacyBase.seguranca, kdfIters: 2_000_000_000 } },
        password
      ),
    /iterações/i
  );

  // deriveVaultKey direto fora do intervalo
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await assert.rejects(() => deriveVaultKey(password, salt, 1000), /iterações/i);
  await assert.rejects(() => deriveVaultKey(password, salt, 2_000_000_000), /iterações/i);
});

test('recoveryWrapped uses fixed-size padding (no password length leak) and remains backward-compatible with legacy unpadded envelopes', async () => {
  const state = buildSampleAppState();
  const recoveryKey = generateRecoveryKey();
  const shortPwd = 'Abcd1234'; // 8 chars
  const longPwd = 'SenhaMestraSuperExtensaComQuarentaChars!'; // 40 chars
  assert.equal(shortPwd.length, 8);
  assert.equal(longPwd.length, 40);

  const envShort = await encryptVaultPayload(state, shortPwd, recoveryKey);
  const envLong = await encryptVaultPayload(state, longPwd, recoveryKey);

  assert.ok(envShort.recoveryWrapped);
  assert.ok(envLong.recoveryWrapped);
  // Comprimento exato do ciphertext de recoveryWrapped deve ser idêntico para 8 e 40 chars
  assert.equal(
    envShort.recoveryWrapped.ciphertext.length,
    envLong.recoveryWrapped.ciphertext.length
  );

  // Ambos desbloqueiam corretamente via Recovery Key e via Senha Mestra
  assert.deepEqual(await decryptVaultPayload<AppState>(envShort, recoveryKey), state);
  assert.deepEqual(await decryptVaultPayload<AppState>(envLong, recoveryKey), state);
  assert.deepEqual(await decryptVaultPayload<AppState>(envShort, shortPwd), state);
  assert.deepEqual(await decryptVaultPayload<AppState>(envLong, longPwd), state);

  // Retrocompatibilidade com envelope v4.0 antigo cujo recoveryWrapped não tinha padding
  const legacyUnpaddedPwd = 'SenhaLegadoSemPad#26';
  const envWithOldRec = await encryptVaultPayload(state, legacyUnpaddedPwd);
  const recSalt = crypto.getRandomValues(new Uint8Array(16));
  const recIv = crypto.getRandomValues(new Uint8Array(12));
  const recKey = await deriveVaultKey(normalizeRecoveryKey(recoveryKey), recSalt, VAULT_ITERATIONS);
  const unpaddedCt = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: recIv },
      recKey,
      new TextEncoder().encode(legacyUnpaddedPwd)
    )
  );
  const toB64 = (u8: Uint8Array) => {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  };
  envWithOldRec.recoveryWrapped = {
    kdf: 'PBKDF2-SHA256',
    iterations: VAULT_ITERATIONS,
    salt: toB64(recSalt),
    iv: toB64(recIv),
    ciphertext: toB64(unpaddedCt),
  };

  const unlockedOld = await unlockVaultWithSession<AppState>(envWithOldRec, recoveryKey);
  assert.equal(unlockedOld.unlockedViaRecovery, true);
  assert.deepEqual(unlockedOld.data, state);
});

test('VaultSession guarantees non-extractable CryptoKey and distinct CSPRNG IV on every encryptWithVaultSession call', async () => {
  const state = buildSampleAppState();
  const password = 'SessaoSegura#2026';
  const recoveryKey = generateRecoveryKey();

  const { envelope: envInitial, session } = await createVaultSession(state, password, recoveryKey);

  // Chave deve ser estritamente inextratível
  assert.equal(session.vaultKey.extractable, false);
  await assert.rejects(() => crypto.subtle.exportKey('raw', session.vaultKey));

  // Chamadas consecutivas devem gerar IVs distintos e ciphertexts distintos
  const envA = await encryptWithVaultSession(state, session);
  const envB = await encryptWithVaultSession(state, session);

  assert.notEqual(envA.iv, envInitial.iv);
  assert.notEqual(envB.iv, envInitial.iv);
  assert.notEqual(envA.iv, envB.iv);
  assert.notEqual(envA.ciphertext, envB.ciphertext);
  assert.equal(envA.salt, session.salt);
  assert.equal(envB.salt, session.salt);

  assert.deepEqual(await decryptVaultPayload<AppState>(envA, password), state);
  assert.deepEqual(await decryptVaultPayload<AppState>(envB, password), state);
});

test('Anti-brute-force exponential backoff: 4 free failures, 15s on 5th, 30s on 6th, capped at 300s, F5 persistence, time unlock and reset', async () => {
  assert.equal(VAULT_LOCKOUT_STORAGE_KEY, 'FINTRACK_VAULT_LOCKOUT_V1');
  assert.equal(MAX_FREE_UNLOCK_ATTEMPTS, 5);

  resetVaultUnlockLockout();
  const t0 = 1_700_000_000_000;

  assert.deepEqual(getVaultUnlockLockoutState(t0), {
    failedAttempts: 0,
    lockedUntilMs: 0,
    remainingSeconds: 0,
    isLockedOut: false,
  });

  // 1ª a 4ª falhas: sem bloqueio (cooldownSeconds = 0)
  for (let attempt = 1; attempt <= 4; attempt++) {
    const rec = recordFailedVaultUnlock(t0);
    assert.deepEqual(rec, {
      failedAttempts: attempt,
      cooldownSeconds: 0,
      lockedUntilMs: 0,
    });
    assert.deepEqual(getVaultUnlockLockoutState(t0), {
      failedAttempts: attempt,
      lockedUntilMs: 0,
      remainingSeconds: 0,
      isLockedOut: false,
    });
  }

  // 5ª falha: backoff de 15s
  const fail5 = recordFailedVaultUnlock(t0);
  assert.deepEqual(fail5, {
    failedAttempts: 5,
    cooldownSeconds: 15,
    lockedUntilMs: t0 + 15_000,
  });
  assert.deepEqual(getVaultUnlockLockoutState(t0), {
    failedAttempts: 5,
    lockedUntilMs: t0 + 15_000,
    remainingSeconds: 15,
    isLockedOut: true,
  });
  assert.equal(getVaultUnlockLockoutState(t0 + 7_200).remainingSeconds, 8);
  assert.equal(getVaultUnlockLockoutState(t0 + 7_200).isLockedOut, true);

  // 6ª falha: backoff de 30s
  const t1 = t0 + 15_000;
  const fail6 = recordFailedVaultUnlock(t1);
  assert.deepEqual(fail6, {
    failedAttempts: 6,
    cooldownSeconds: 30,
    lockedUntilMs: t1 + 30_000,
  });
  assert.deepEqual(getVaultUnlockLockoutState(t1), {
    failedAttempts: 6,
    lockedUntilMs: t1 + 30_000,
    remainingSeconds: 30,
    isLockedOut: true,
  });

  // Avanço de tempo libera o bloqueio mantendo histórico de tentativas até sucesso
  const tAfter6 = t1 + 30_000;
  assert.deepEqual(getVaultUnlockLockoutState(tAfter6), {
    failedAttempts: 6,
    lockedUntilMs: t1 + 30_000,
    remainingSeconds: 0,
    isLockedOut: false,
  });

  // Progressão 7ª (60s), 8ª (120s), 9ª (240s), 10ª (300s teto), 11ª (300s teto)
  assert.equal(recordFailedVaultUnlock(tAfter6).cooldownSeconds, 60);
  assert.equal(recordFailedVaultUnlock(tAfter6 + 60_000).cooldownSeconds, 120);
  assert.equal(recordFailedVaultUnlock(tAfter6 + 180_000).cooldownSeconds, 240);
  assert.equal(recordFailedVaultUnlock(tAfter6 + 420_000).cooldownSeconds, 300);
  assert.equal(recordFailedVaultUnlock(tAfter6 + 720_000).cooldownSeconds, 300);

  // Reset explícito zera contador e bloqueio
  resetVaultUnlockLockout();
  assert.deepEqual(getVaultUnlockLockoutState(tAfter6 + 720_000), {
    failedAttempts: 0,
    lockedUntilMs: 0,
    remainingSeconds: 0,
    isLockedOut: false,
  });

  // Persistência em localStorage resistindo a F5/reload + reset automático após unlockVaultWithSession
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const backingStore = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return backingStore.size;
    },
    clear() {
      backingStore.clear();
    },
    getItem(key: string) {
      return backingStore.has(key) ? backingStore.get(key)! : null;
    },
    key(index: number) {
      return Array.from(backingStore.keys())[index] ?? null;
    },
    removeItem(key: string) {
      backingStore.delete(key);
    },
    setItem(key: string, value: string) {
      backingStore.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    configurable: true,
    writable: true,
  });

  try {
    resetVaultUnlockLockout();
    for (let i = 0; i < 5; i++) {
      recordFailedVaultUnlock(t0);
    }
    const persistedRaw = backingStore.get(VAULT_LOCKOUT_STORAGE_KEY);
    assert.ok(persistedRaw);
    assert.deepEqual(JSON.parse(persistedRaw), {
      failedAttempts: 5,
      lockedUntilMs: t0 + 15_000,
    });

    // Simula F5/reload lendo estado diretamente do storage persistido
    backingStore.set(
      VAULT_LOCKOUT_STORAGE_KEY,
      JSON.stringify({ failedAttempts: 7, lockedUntilMs: t0 + 60_000 })
    );
    assert.deepEqual(getVaultUnlockLockoutState(t0), {
      failedAttempts: 7,
      lockedUntilMs: t0 + 60_000,
      remainingSeconds: 60,
      isLockedOut: true,
    });

    // Desbloqueio bem-sucedido chama resetVaultUnlockLockout automaticamente
    const state = buildSampleAppState();
    const pwd = 'SenhaCorretaReset#2026';
    const env = await encryptVaultPayload(state, pwd);
    await unlockVaultWithSession<AppState>(env, pwd);

    assert.equal(backingStore.has(VAULT_LOCKOUT_STORAGE_KEY), false);
    assert.deepEqual(getVaultUnlockLockoutState(t0), {
      failedAttempts: 0,
      lockedUntilMs: 0,
      remainingSeconds: 0,
      isLockedOut: false,
    });
  } finally {
    resetVaultUnlockLockout();
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  }
});

test('rotateVaultMasterPassword rotates secret in-memory, invalidates old password & old Recovery Key, and unlocks with new password & new Recovery Key', async () => {
  const state = buildSampleAppState();
  const oldPassword = 'SenhaAntiga#2026!';
  const oldRecoveryKey = generateRecoveryKey();
  const newPassword = 'NovaSenhaForte#2027!';

  const { envelope: oldEnvelope } = await createVaultSession(state, oldPassword, oldRecoveryKey);

  // Rejeita nova senha curta (< 8 chars)
  await assert.rejects(
    () => rotateVaultMasterPassword<AppState>(oldEnvelope, oldPassword, 'curta77'),
    /mínimo 8 caracteres/i
  );

  // Rejeita se currentSecret estiver incorreta (sem vazar dados em claro)
  await assert.rejects(
    () => rotateVaultMasterPassword<AppState>(oldEnvelope, 'CredencialErrada#99', newPassword),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(err.message.includes('Nubank'), false);
      assert.equal(err.message.includes('4250'), false);
      return true;
    }
  );

  // Rotaciona com sucesso via Senha Mestra atual
  const rotated = await rotateVaultMasterPassword<AppState>(oldEnvelope, oldPassword, newPassword);

  assert.deepEqual(rotated.data, state);
  assert.equal(rotated.session.vaultKey.extractable, false);
  assert.equal(rotated.envelope.__vault, true);
  assert.equal(rotated.envelope.version, '4.0');
  assert.notEqual(rotated.envelope.salt, oldEnvelope.salt);
  assert.notEqual(rotated.envelope.iv, oldEnvelope.iv);
  assert.ok(rotated.envelope.recoveryWrapped);
  assert.notEqual(rotated.envelope.recoveryWrapped.salt, oldEnvelope.recoveryWrapped?.salt);
  assert.notEqual(rotated.newRecoveryKey, oldRecoveryKey);
  assert.match(rotated.newRecoveryKey, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){5}$/);

  // Garante zero texto claro no novo envelope
  const serialized = JSON.stringify(rotated.envelope);
  assert.equal(serialized.includes('Nubank'), false);
  assert.equal(serialized.includes(newPassword), false);
  assert.equal(serialized.includes(oldPassword), false);

  // Senha antiga e Recovery Key antiga são invalidadas no novo envelope
  await assert.rejects(() => decryptVaultPayload(rotated.envelope, oldPassword), /falha ao decifrar/i);
  await assert.rejects(() => unlockVaultWithSession(rotated.envelope, oldPassword), /falha ao decifrar/i);
  await assert.rejects(
    () => decryptVaultPayload(rotated.envelope, oldRecoveryKey),
    /falha ao decifrar/i
  );
  await assert.rejects(
    () => unlockVaultWithSession(rotated.envelope, oldRecoveryKey),
    /falha ao decifrar/i
  );

  // Novo envelope desbloqueia com a nova Senha Mestra e com a nova Recovery Key
  const byNewPwd = await unlockVaultWithSession<AppState>(rotated.envelope, newPassword);
  assert.equal(byNewPwd.unlockedViaRecovery, false);
  assert.deepEqual(byNewPwd.data, state);

  const byNewRec = await unlockVaultWithSession<AppState>(
    rotated.envelope,
    normalizeRecoveryKey(rotated.newRecoveryKey).toLowerCase()
  );
  assert.equal(byNewRec.unlockedViaRecovery, true);
  assert.deepEqual(byNewRec.data, state);

  // Também suporta rotação autenticando com a Recovery Key vigente
  const thirdPassword = 'TerceiraSenha#2028!';
  const rotatedViaRec = await rotateVaultMasterPassword<AppState>(
    rotated.envelope,
    rotated.newRecoveryKey,
    thirdPassword
  );
  await assert.rejects(
    () => decryptVaultPayload(rotatedViaRec.envelope, newPassword),
    /falha ao decifrar/i
  );
  await assert.rejects(
    () => decryptVaultPayload(rotatedViaRec.envelope, rotated.newRecoveryKey),
    /falha ao decifrar/i
  );
  assert.deepEqual(
    await decryptVaultPayload<AppState>(rotatedViaRec.envelope, thirdPassword),
    state
  );
  assert.deepEqual(
    await decryptVaultPayload<AppState>(rotatedViaRec.envelope, rotatedViaRec.newRecoveryKey),
    state
  );
});
