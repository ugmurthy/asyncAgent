declare module "katex/dist/contrib/auto-render.mjs" {
  interface RenderMathInElementOptions {
    delimiters?: Array<{ left: string; right: string; display: boolean }>;
    throwOnError?: boolean;
    errorColor?: string;
    macros?: Record<string, string>;
    trust?: boolean | ((context: { command: string; url: string; protocol: string }) => boolean);
  }

  export default function renderMathInElement(
    element: HTMLElement,
    options?: RenderMathInElementOptions
  ): void;
}
