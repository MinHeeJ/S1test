import type { ScreenRegistration } from "../../app/router";
import ResumesPage from "./SC-RESUMES";
import EditorPage from "./SC-EDITOR";
import PrintPage from "./SC-PRINT";

/** Wiring imports registrations; feature code never imports a registry that imports this module. */
export const resumeScreens: ScreenRegistration[] = [
  { path: "/resumes", element: <ResumesPage /> },
  { path: "/resumes/:id/edit", element: <EditorPage /> },
  { path: "/print/:id", element: <PrintPage /> },
];
