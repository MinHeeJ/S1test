import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";

/** The shared router may spread these entries; feature code never imports the router registry. */
export const authRoutes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
];
