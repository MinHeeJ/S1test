import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { configureApi } from '../shared/api';
import LoginPage from '../pages/auth/SC-LOGIN';
import SignupPage from '../pages/auth/SC-SIGNUP';
import { resumeRoutes } from '../pages/resumes/routes';

/** Register product screens; callers may supply route replacements without duplicate paths. */
export function createAppRoutes(routes: RouteObject[] = []): RouteObject[] {
  const productRoutes: RouteObject[] = [
    ...resumeRoutes,
    { path: '/login', element: <LoginPage /> },
    { path: '/signup', element: <SignupPage /> },
  ];
  return [
    { path: '/', element: <Navigate to="/resumes" replace /> },
    ...routes,
    ...productRoutes.filter(route => !routes.some(supplied => supplied.path === route.path)),
  ];
}

/** Expired sessions use the same router, rather than reloading and discarding the SPA boundary. */
export function createAppRouter(routes: RouteObject[] = []) {
  const router = createBrowserRouter(createAppRoutes(routes));
  configureApi({ onUnauthorized: () => { void router.navigate('/login', { replace: true }); } });
  return router;
}
