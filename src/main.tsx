import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import {
  STORAGE_KEY,
  isVaultPayload,
  safeGetStorageItem,
  safeJsonParse,
} from './utils/storage';
import { loadVaultSessionConfig } from './utils/cryptoVault';
import './index.css';

const maskMonetaryText = (message: string): string =>
  message.replace(/(?:[-−]\s*)?R\$\s*(?:[-−]\s*)?\d+(?:[.,]\d+)*/g, 'R$ •••••');

interface EmergencyStorageStatus {
  raw: string | null;
  isEncryptedVault: boolean;
  vaultConfigEnabled: boolean;
}

function inspectEmergencyStorage(): EmergencyStorageStatus {
  const raw = safeGetStorageItem(STORAGE_KEY);
  const vaultConfigEnabled = loadVaultSessionConfig().enabled;
  let isEncryptedVault = false;
  if (raw) {
    try {
      isEncryptedVault = isVaultPayload(safeJsonParse(raw));
    } catch {
      isEncryptedVault = false;
    }
  }
  return { raw, isEncryptedVault, vaultConfigEnabled };
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  downloadNotice: { type: 'info' | 'blocked'; message: string } | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    downloadNotice: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado na renderização da interface.',
      downloadNotice: null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FinTrack ErrorBoundary:', error, info);
  }

  handleEmergencyDownload = () => {
    const { raw, isEncryptedVault, vaultConfigEnabled } = inspectEmergencyStorage();

    if (!isEncryptedVault && vaultConfigEnabled) {
      this.setState({
        downloadNotice: {
          type: 'blocked',
          message:
            'Download em texto claro bloqueado: o Cofre Criptográfico está ativo, mas o conteúdo local não está no formato cifrado .vault. Recarregue a página para validar o estado do cofre.',
        },
      });
      return;
    }

    const payload = raw || '{}';
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isEncryptedVault
      ? 'fintrack-emergencia.vault'
      : `fintrack_emergency_backup_${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    this.setState({
      downloadNotice: {
        type: 'info',
        message: isEncryptedVault
          ? 'Backup de emergência cifrado (fintrack-emergencia.vault) baixado. Seus dados permanecem protegidos por criptografia AES-256-GCM.'
          : 'Backup de emergência (.json) baixado com sucesso.',
      },
    });
  };

  render() {
    if (this.state.hasError) {
      const { isEncryptedVault, vaultConfigEnabled } = inspectEmergencyStorage();
      const plaintextBlocked = !isEncryptedVault && vaultConfigEnabled;
      const safeErrorMessage = maskMonetaryText(this.state.errorMessage);
      const { downloadNotice } = this.state;

      return (
        <div
          role="alert"
          className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h1 className="font-display text-lg font-bold text-rose-700 dark:text-rose-400">
              Algo interrompeu a exibição do FinTrack
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isEncryptedVault
                ? 'Seus dados financeiros continuam salvos localmente e protegidos no Cofre Criptográfico (AES-256-GCM). Você pode recarregar a página ou baixar uma cópia de emergência cifrada (.vault) agora.'
                : plaintextBlocked
                  ? 'O Cofre Criptográfico está ativo, portanto o download de emergência em texto claro foi bloqueado por segurança. Recarregue a página para restabelecer o cofre.'
                  : 'Seus dados financeiros continuam salvos localmente no navegador. Você pode recarregar a página ou baixar uma cópia de emergência agora.'}
            </p>
            <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 p-3 rounded-lg break-words">
              {safeErrorMessage}
            </p>
            {downloadNotice && (
              <p
                role={downloadNotice.type === 'blocked' ? 'alert' : 'status'}
                className={`text-xs font-semibold p-3 rounded-lg border ${
                  downloadNotice.type === 'blocked'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {downloadNotice.message}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                Recarregar Página
              </button>
              {!plaintextBlocked && (
                <button
                  type="button"
                  onClick={this.handleEmergencyDownload}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isEncryptedVault
                    ? 'Baixar Backup Cifrado (.vault)'
                    : 'Baixar Backup de Emergência'}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
