import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import "./tokens.css";
import { ApplicationRouter } from "./router";

/** The composition owner supplies the real route tree; no placeholder routes are registered here. */
export function mountApplication(application: ReactNode) {
  const element = document.getElementById("root");
  if (!element) throw new Error("Application root is missing");
  const root = createRoot(element);
  root.render(application);
  return root;
}

mountApplication(<ApplicationRouter />);
