/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    content: import('react').DetailedHTMLProps<
      import('react').HTMLAttributes<HTMLElement>,
      HTMLElement
    >
    titlebar: import('react').DetailedHTMLProps<
      import('react').HTMLAttributes<HTMLElement>,
      HTMLElement
    >
  }
}
