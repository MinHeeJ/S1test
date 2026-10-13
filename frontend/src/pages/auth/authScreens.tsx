import type { ScreenRegistration } from "../../app/router";
import { LoginScreen } from "./SC-LOGIN";
import { SignupScreen } from "./SC-SIGNUP";

/** Wiring imports this registry; features only import shared router types, avoiding runtime cycles. */
export const authScreens: ScreenRegistration[] = [
  { path: "/login", element: <LoginScreen /> },
  { path: "/signup", element: <SignupScreen /> },
];
