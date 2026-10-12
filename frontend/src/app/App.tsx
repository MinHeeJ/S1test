import { Suspense, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { configureApiEvents } from "../shared/api";
import { Toast, useToast } from "../shared/Toast";
import { AppRoutes, type Screens } from "./router";
import { useSessionStore } from "./session";
import "./app.css";

export function App({ screens }: { screens: Screens }) {
  useEffect(() => {
    configureApiEvents({
      unauthorized: () => {
        useSessionStore.getState().clear();
        window.location.assign("/login");
      },
      error: (message) => useToast.getState().show(message),
    });
    void useSessionStore.getState().load();
  }, []);
  return (
    <BrowserRouter>
      <Suspense fallback={<p role="status">화면을 불러오고 있습니다…</p>}>
        <AppRoutes screens={screens} />
      </Suspense>
      <Toast />
    </BrowserRouter>
  );
}
