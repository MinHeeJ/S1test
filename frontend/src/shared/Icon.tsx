import type { CSSProperties } from "react";

const paths = {
  document: "M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6",
  plus: "M12 5v14M5 12h14",
  arrow: "M19 12H5m6-6-6 6 6 6",
  chevron: "m6 9 6 6 6-6",
  edit: "m15 4 5 5M4 20l4-1L20 7l-4-4L4 15v5Z",
  copy: "M9 9h11v11H9V9ZM4 15H3V3h12v1",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  logout: "M9 3H4v18h5M9 12h12m-5-5 5 5-5 5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  check: "m5 12 4 4L19 6",
  warning: "m12 3 10 18H2L12 3ZM12 9v5M12 17h.01",
} as const;

export function Icon({
  name,
  size = 18,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
