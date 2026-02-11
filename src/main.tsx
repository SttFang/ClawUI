import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createHashRouter } from "react-router-dom";
import App from "./App";
import { RouteErrorBoundary } from "./components/ErrorBoundary";
import "./locales/i18n";
import "katex/dist/katex.min.css";
import "./index.css";
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
      { path: "agents", element: <AgentsPage /> },
      {
        path: "channels",
        element: <Navigate to="/settings?tab=tokens&section=channels" replace />,
      },
      {
        path: "tools",
        element: <Navigate to="/settings?tab=security&section=tools" replace />,
      },
      {
        path: "mcp",
        element: <Navigate to="/settings?tab=security&section=mcp" replace />,
      },
      {
        path: "plugins",
        element: <Navigate to="/settings?tab=security&section=plugins" replace />,
      },
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
