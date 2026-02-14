import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";

export type SkillInstallOption = {
  id: string;
  label: string;
};

export type SkillStatusEntry = {
  name: string;
  description: string;
  source: string;
  skillKey: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  install: SkillInstallOption[];
};

export type SkillStatusReport = {
  skills: SkillStatusEntry[];
};

export type SkillMessageMap = Record<string, { kind: "success" | "error"; text: string }>;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useSkillsManager() {
  const { t } = useTranslation("common");
  const loadingRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SkillStatusReport | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<SkillMessageMap>({});

  const setSkillMessage = (
    skillKey: string,
    message?: { kind: "success" | "error"; text: string },
  ) => {
    setMessages((prev) => {
      const next = { ...prev };
      if (message) {
        next[skillKey] = message;
      } else {
        delete next[skillKey];
      }
      return next;
    });
  };

  const loadSkillsStatus = useCallback(async (clearMessages = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (clearMessages) {
      setMessages({});
    }

    setLoading(true);
    setError(null);
    try {
      const payload = (await ipc.chat.request("skills.status", {})) as SkillStatusReport;
      setReport(payload);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkillsStatus(true);
  }, [loadSkillsStatus]);

  const handleToggle = async (skill: SkillStatusEntry) => {
    setBusyKey(skill.skillKey);
    setError(null);
    try {
      const enabled = skill.disabled;
      await ipc.chat.request("skills.update", { skillKey: skill.skillKey, enabled });
      await loadSkillsStatus();
      setSkillMessage(skill.skillKey, {
        kind: "success",
        text: enabled ? t("skillsPanel.messages.enabled") : t("skillsPanel.messages.disabled"),
      });
    } catch (toggleError) {
      const message = getErrorMessage(toggleError);
      setError(message);
      setSkillMessage(skill.skillKey, { kind: "error", text: message });
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveApiKey = async (skillKey: string) => {
    setBusyKey(skillKey);
    setError(null);
    try {
      const apiKey = edits[skillKey] ?? "";
      await ipc.chat.request("skills.update", { skillKey, apiKey });
      await loadSkillsStatus();
      setSkillMessage(skillKey, {
        kind: "success",
        text: t("skillsPanel.messages.apiKeySaved"),
      });
    } catch (saveError) {
      const message = getErrorMessage(saveError);
      setError(message);
      setSkillMessage(skillKey, { kind: "error", text: message });
    } finally {
      setBusyKey(null);
    }
  };

  const handleInstall = async (skill: SkillStatusEntry) => {
    const option = skill.install[0];
    if (!option) return;

    setBusyKey(skill.skillKey);
    setError(null);
    try {
      const result = (await ipc.chat.request("skills.install", {
        name: skill.name,
        installId: option.id,
        timeoutMs: 120000,
      })) as { message?: string };
      await loadSkillsStatus();
      setSkillMessage(skill.skillKey, {
        kind: "success",
        text: result?.message ?? t("skillsPanel.actions.installed"),
      });
    } catch (installError) {
      const message = getErrorMessage(installError);
      setError(message);
      setSkillMessage(skill.skillKey, { kind: "error", text: message });
    } finally {
      setBusyKey(null);
    }
  };

  return {
    loading,
    error,
    report,
    edits,
    setEdits,
    busyKey,
    messages,
    loadSkillsStatus,
    handleToggle,
    handleSaveApiKey,
    handleInstall,
  };
}
