export {};

declare global {
  interface Window {
    cadencia?: {
      isNative: boolean;
      platform: string;
    };
  }
}
