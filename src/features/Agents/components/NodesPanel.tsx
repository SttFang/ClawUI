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

  const onlineCount = nodes.filter((n) => n.connected).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {nodes.length} {t("agents.agentDesktop.tabs.nodes")}
          </span>
          <span>·</span>
          <span>
            {onlineCount} {t("agents.agentDesktop.nodes.online")}
          </span>
        </div>
        {pendingNodes.length > 0 && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
            {pendingNodes.length} {t("agents.agentDesktop.nodes.pending")}
          </span>
        )}
      </div>

      {nodesError && <div className="px-1 pb-3 text-sm text-destructive">{nodesError}</div>}

      {/* Pending nodes */}
      {pendingNodes.length > 0 && (
        <div className="mb-4 space-y-2 border-l-2 border-amber-500 pl-3">
          {pendingNodes.map((pn) => (
            <Card key={pn.requestId}>
              <CardContent className="p-3 space-y-2">
                <div className="font-medium text-sm">{pn.displayName ?? pn.requestId}</div>
                {pn.platform && <div className="text-xs text-muted-foreground">{pn.platform}</div>}
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
      )}

      {/* Paired nodes */}
      {nodesLoading && nodes.length === 0 ? (
        <div className="text-sm text-muted-foreground px-1">{t("status.loading")}</div>
      ) : nodes.length === 0 ? (
        <div className="text-sm text-muted-foreground px-1">
          {t("agents.agentDesktop.nodes.empty")}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {nodes.map((node) => (
            <Card key={node.nodeId}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{node.displayName ?? node.nodeId}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`size-1.5 rounded-full ${node.connected ? "bg-green-500" : "bg-muted-foreground/40"}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {node.connected
                        ? t("agents.agentDesktop.nodes.online")
                        : t("agents.agentDesktop.nodes.offline")}
                    </span>
                  </div>
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
  );
}
