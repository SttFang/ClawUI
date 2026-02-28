import { useTranslation } from "react-i18next";
import { useAgentsStore } from "@/store/agents";
import { agentsSelectors } from "@/store/agents/selectors";
import { ControlDropdown } from "../components/SessionControlStrip";

export function SkillSelector(props: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("chat");
  const skills = useAgentsStore(agentsSelectors.selectSkillEntries);

  const options = [
    { value: "", label: t("sessionStrip.noSkill") },
    ...skills.map((s) => ({ value: s.name, label: s.name })),
  ];

  const triggerText = props.value || t("sessionStrip.skill");

  return (
    <ControlDropdown
      label={t("sessionStrip.skill")}
      triggerText={triggerText}
      value={props.value}
      options={options}
      disabled={props.disabled}
      onChange={props.onChange}
    />
  );
}
