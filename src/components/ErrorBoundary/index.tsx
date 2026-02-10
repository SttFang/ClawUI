import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@clawui/ui";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  let title = t("errorBoundary.unexpectedError");
  let message = t("errorBoundary.unexpectedErrorMessage");

  if (isRouteErrorResponse(error)) {
    title = `${error.status}`;
    message = error.statusText || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("errorBoundary.reload")}
          </Button>
          <Button onClick={() => navigate("/")}>
            {t("errorBoundary.goHome")}
          </Button>
        </div>
      </div>
    </div>
  );
}
