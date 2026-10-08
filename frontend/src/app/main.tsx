import React from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  type RouteObject,
} from "react-router-dom";
import "./app.css";
import { applicationRoutes } from "./router";

/** 최종 화면 등록 단계가 실제 route를 전달한다. 미구현 화면이나 가짜 세션은 생성하지 않는다. */
export function mountApplication(
  routes: RouteObject[],
  element = document.getElementById("root"),
) {
  if (!element) throw new Error("Application root is missing");
  const root = createRoot(element);
  root.render(
    <React.StrictMode>
      <RouterProvider router={createBrowserRouter(routes)} />
    </React.StrictMode>,
  );
  return root;
}

mountApplication(applicationRoutes);
