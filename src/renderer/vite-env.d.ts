/// <reference types="vite/client" />

interface OrchestraAPI {
  platform: string;
  versions: {
    node: string;
    electron: string;
    chrome: string;
  };
}

declare global {
  interface Window {
    orchestra: OrchestraAPI;
  }
}

export {};
