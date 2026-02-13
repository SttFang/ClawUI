import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createHashRouter } from "react-router-dom";
import App from "./App";
import { RouteErrorBoundary } from "./components/ErrorBoundary";
import "./locales/i18n";
import "katex/dist/katex.min.css";
import "./index.css";
import { SETTINGS_ALIAS_ROUTES } from "./router/settingsRouteSchema";
import AgentsPage from "./routes/agents/page";
import OnboardingPage from "./routes/onboarding/page";
// Routes
import ChatPage from "./routes/page";
import SettingsPage from "./routes/settings/page";
import UsagePage from "./routes/usage/page";

const router = createHashRouter([
  {
    path: "/onboarding",
    element: <OnboardingPage />,
  },
  {
    path: "/",
    element: <App />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <ChatPage /> },
      { path: "chat", element: <Navigate to="/" replace /> },
      { path: "agents", element: <AgentsPage /> },
      ...SETTINGS_ALIAS_ROUTES.map((route) => ({
        path: route.path,
        element: <Navigate to={route.to} replace />,
      })),
      { path: "scheduler", element: <Navigate to="/agents?section=cron" replace /> },
      { path: "usage", element: <UsagePage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
