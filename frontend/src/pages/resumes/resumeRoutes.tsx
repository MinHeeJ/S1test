import type { RouteObject } from "react-router-dom";
import { ResumeListPage } from "./ResumeListPage";
import { ResumeEditorPage } from "./ResumeEditorPage";
import { PrintPage } from "./PrintPage";

/** Feature-only entries consumed by the final route registry, with no import back into that registry. */
export const resumeRoutes: RouteObject[] = [
  { path: "/resumes", element: <ResumeListPage /> },
  { path: "/resumes/:id/edit", element: <ResumeEditorPage /> },
  { path: "/print/:id", element: <PrintPage /> },
];
