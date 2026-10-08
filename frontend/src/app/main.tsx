import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ApplicationRoutes } from "./router";
import "./product.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApplicationRoutes />
    </BrowserRouter>
  </React.StrictMode>,
);
