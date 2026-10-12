import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registeredScreens } from "./router";

createRoot(document.getElementById("root")!).render(
  <App screens={registeredScreens} />,
);
