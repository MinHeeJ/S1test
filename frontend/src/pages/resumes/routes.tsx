import type { RouteObject } from "react-router-dom";
import { ResumeListPage } from "./ResumeListPage";
import { ResumeEditorPage } from "./ResumeEditorPage";
import { PrintPage } from "./PrintPage";

/** Assembly-owned router imports these entries; feature API modules never import the router. */
export const resumeRoutes: RouteObject[] = [
  { path: "/resumes", element: <ResumeListPage /> },
  { path: "/resumes/:id/edit", element: <ResumeEditorPage /> },
  { path: "/print/:id", element: <PrintPage /> },
];
