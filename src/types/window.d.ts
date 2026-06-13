export {};

declare global {
  interface ChatSelectionHandlers {
    enter: () => void;
    toggle: (messageId: string, messageEl: HTMLElement) => void;
    cancel: () => void;
    sync: () => void;
    isActive: () => boolean;
  }

  interface QRCodeConstructor {
    new (element: HTMLElement, options: { text: string; width: number; height: number }): void;
  }

  interface Window {
    __chatSelectionMode?: boolean;
    __chatSelectionHandlers?: ChatSelectionHandlers;
    __history_scroll_bound?: boolean;
    __history_scroll_handler?: () => void;
    showProfileToast?: (message: string) => void;
    QRCode?: QRCodeConstructor;
    CybPrivacy?: {
      getConsent: () => {
        functional: boolean;
        diagnostic: boolean;
        usage: boolean;
        decided: boolean;
      };
      allows: (category: 'necessary' | 'functional' | 'diagnostic' | 'usage') => boolean;
      open: () => void;
      apply: () => void;
    };
  }
}
