import type { RouteObject } from 'react-router-dom';
import { ResumesPage } from './SC-RESUMES';
import { EditorPage } from './SC-EDITOR';
import { PrintPage } from './SC-PRINT';

/** Wiring imports these routes; feature code never imports the shared router registry. */
export const resumeRoutes: RouteObject[] = [
  { path: '/resumes', element: <ResumesPage /> },
  { path: '/resumes/:id/edit', element: <EditorPage /> },
  { path: '/print/:id', element: <PrintPage /> },
];
