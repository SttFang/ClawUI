import { useEffect } from "react";
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
  const skillsRaw = useAgentsStore(agentsSelectors.selectSkills);
  const loadSkills = useAgentsStore((s) => s.loadSkills);

  // skills === null means never loaded; [] means loaded but empty
  useEffect(() => {
    if (skillsRaw === null) {
      void loadSkills();
    }
  }, [skillsRaw, loadSkills]);

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
