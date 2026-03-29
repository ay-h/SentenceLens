export interface ElectronAPI {
  getAppDataDir: () => Promise<string>;
  getServerStatus: () => Promise<{ isRunning: boolean }>;
  startServer: () => Promise<{ success: boolean; error?: string }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;
  changeDataDir: () => Promise<{
    canceled?: boolean;
    success?: boolean;
    error?: string;
    newDir?: string;
    restarting?: boolean;
    cleanupWarning?: string | null;
  }>;
  useExistingDataDir: () => Promise<{
    canceled?: boolean;
    success?: boolean;
    error?: string;
    newDir?: string;
    restarting?: boolean;
    reused?: boolean;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
