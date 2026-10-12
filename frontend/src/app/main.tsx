import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useRoutes } from "react-router-dom";
import { appRoutes } from "./router";

function ApplicationRoutes() {
  return useRoutes(appRoutes);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApplicationRoutes />
    </BrowserRouter>
  </React.StrictMode>,
);
