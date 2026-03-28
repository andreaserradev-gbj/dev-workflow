declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export interface BuildInfo {
  version: string;
  buildDate: string;
  modeLabel: string;
}

function detectModeLabel(): string {
  return import.meta.env.DEV ? 'dev' : 'public build';
}

export const BUILD_INFO: BuildInfo = {
  version: __APP_VERSION__,
  buildDate: __BUILD_DATE__,
  modeLabel: detectModeLabel(),
};
