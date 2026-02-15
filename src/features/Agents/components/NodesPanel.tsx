import { Button, Card, CardContent } from "@clawui/ui";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAgentsStore, agentsSelectors } from "@/store/agents";

export function NodesPanel() {
  const { t } = useTranslation("common");
  const nodes = useAgentsStore(agentsSelectors.selectNodes);
  const pendingNodes = useAgentsStore(agentsSelectors.selectPendingNodes);
  const nodesError = useAgentsStore(agentsSelectors.selectNodesError);
  const nodesLoading = useAgentsStore(agentsSelectors.selectNodesLoading);
  const loadNodes = useAgentsStore((s) => s.loadNodes);
  const loadPendingNodes = useAgentsStore((s) => s.loadPendingNodes);
  const approveNode = useAgentsStore((s) => s.approveNode);
  const rejectNode = useAgentsStore((s) => s.rejectNode);

  useEffect(() => {
    void loadNodes();
    void loadPendingNodes();
  }, [loadNodes, loadPendingNodes]);

  return (
    <div className="space-y-4">
      {nodesError && <div className="text-sm text-destructive">{nodesError}</div>}

      {/* Pending nodes */}
      {pendingNodes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">{t("agents.agentDesktop.nodes.pending")}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {pendingNodes.map((pn) => (
              <Card key={pn.requestId}>
                <CardContent className="p-3 space-y-2">
                  <div className="font-medium text-sm">{pn.displayName ?? pn.requestId}</div>
                  {pn.platform && (
                    <div className="text-xs text-muted-foreground">{pn.platform}</div>
                  )}
                  {pn.expiresAtMs && (
                    <div className="text-xs text-muted-foreground">
                      {t("agents.agentDesktop.nodes.expires", {
                        minutes: Math.max(1, Math.round((pn.expiresAtMs - Date.now()) / 60_000)),
                      })}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveNode(pn.requestId)}>
                      {t("agents.agentDesktop.nodes.approve")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectNode(pn.requestId)}>
                      {t("agents.agentDesktop.nodes.reject")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Paired nodes */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("agents.agentDesktop.nodes.paired")}</h3>
        {nodesLoading && nodes.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("status.loading")}</div>
        ) : nodes.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {t("agents.agentDesktop.nodes.empty")}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {nodes.map((node) => (
              <Card key={node.nodeId}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{node.displayName ?? node.nodeId}</span>
                    <span
                      className={
                        node.connected ? "text-green-600 text-xs" : "text-muted-foreground text-xs"
                      }
                    >
                      {node.connected
                        ? t("agents.agentDesktop.nodes.online")
                        : t("agents.agentDesktop.nodes.offline")}
                    </span>
                  </div>
                  {(node.platform || node.version) && (
                    <div className="text-xs text-muted-foreground">
                      {[node.platform, node.version].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {node.caps && node.caps.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {node.caps.map((cap) => (
                        <span
                          key={cap}
                          className="rounded-md border bg-muted px-1.5 py-0.5 text-[10px]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
