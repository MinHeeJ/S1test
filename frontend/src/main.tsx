import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { createAppRouter } from "./app/router";
import { configureApiClient } from "./shared/apiClient";
import { useToastStore } from "./shared/Toast";
import "./app/app.css";

// Feature owners supply real screen registrations during application integration.
const router = createAppRouter([]);
configureApiClient({
  onUnauthorized: () => {
    void router.navigate("/login");
  },
  onError: (error) => useToastStore.getState().show(error.message),
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
