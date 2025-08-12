export type PywebviewAPI = {[functionName: string]: (...args: unknown[]) => Promise<unknown>};
export type Pywebview<API extends PywebviewAPI = PywebviewAPI> = {
    api: API;
    domJSON: {
        toDOM: unknown;
        toJSON: unknown;
    };
    platform: "gtk" | "qt" | "edgechromium" | "cef" | "mshtml";
    stringify: unknown;
    token: string;
}

declare global {
    interface WindowEventMap {
        pywebviewready: Event;
    }

    interface Window {
        pywebview: Pywebview;
    }
}
