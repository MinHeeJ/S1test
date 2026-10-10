import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ApplicationRouter } from "./router";
import "../shared/workspace.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App>
      <ApplicationRouter />
    </App>
  </React.StrictMode>,
);
