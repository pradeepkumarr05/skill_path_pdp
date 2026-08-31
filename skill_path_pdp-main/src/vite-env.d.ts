/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Minimal shape of the Google Identity Services API loaded via the
// <script src="https://accounts.google.com/gsi/client"> tag in index.html.
interface CredentialResponse {
  credential: string;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (config: {
          client_id: string;
          callback: (response: CredentialResponse) => void;
        }) => void;
        renderButton: (
          parent: HTMLElement,
          options: { type?: string; theme?: string; size?: string; width?: number; text?: string },
        ) => void;
      };
    };
  };
}
