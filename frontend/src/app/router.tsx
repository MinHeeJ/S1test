import type { ReactNode } from "react";
import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from "react-router-dom";
import { AppShell } from "./AppShell";
import { ProtectedRoute } from "./ProtectedRoute";
import { authScreens } from "../pages/auth/authScreens";
import { resumeScreens } from "../pages/resumes/screens";

/** Shared registration owns feature imports; feature registries import router types only. */
export const applicationScreens: ScreenRegistration[] = [
  ...authScreens,
  ...resumeScreens,
];

export interface ScreenRegistration {
  path: "/login" | "/signup" | "/resumes" | "/resumes/:id/edit" | "/print/:id";
  element: ReactNode;
}

export function applicationRoutes(
  screens: ScreenRegistration[] = [],
): RouteObject[] {
  const page = (path: ScreenRegistration["path"]) =>
    screens.find((screen) => screen.path === path)?.element ??
    applicationScreens.find((screen) => screen.path === path)?.element ?? (
      <p role="alert">화면을 연결하지 못했습니다.</p>
    );
  const framedPrint =
    window.self !== window.top ? (
      page("/print/:id")
    ) : (
      <p>인쇄 화면은 편집기의 PDF 내보내기에서만 열 수 있습니다.</p>
    );
  return [
    { path: "/", element: <Navigate to="/resumes" replace /> },
    {
      element: <AppShell />,
      children: [
        { path: "/login", element: page("/login") },
        { path: "/signup", element: page("/signup") },
        {
          element: <ProtectedRoute />,
          children: [
            { path: "/resumes", element: page("/resumes") },
            { path: "/resumes/:id/edit", element: page("/resumes/:id/edit") },
          ],
        },
      ],
    },
    {
      element: <ProtectedRoute />,
      children: [{ path: "/print/:id", element: framedPrint }],
    },
    { path: "*", element: <p role="alert">화면을 찾을 수 없습니다.</p> },
  ];
}

export function createAppRouter(screens: ScreenRegistration[]) {
  return createBrowserRouter(applicationRoutes(screens));
}
