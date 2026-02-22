declare global {
  interface Window {
    __BASE_PATH__?: string;
  }
}

export const BASE_PATH: string =
  typeof window !== "undefined" ? (window.__BASE_PATH__ ?? "") : "";

export function withBase(path: string): string {
  return BASE_PATH ? `${BASE_PATH}${path}` : path;
}
