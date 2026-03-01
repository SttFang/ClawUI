import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@clawui/ui";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SkillEntry } from "@/lib/ipc";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/store/agents";
import { agentsSelectors } from "@/store/agents/selectors";
import { triggerCn } from "../components/SessionControlStrip";

const SOURCE_GROUP_KEYS: Record<string, string> = {
  workspace: "groups.workspace",
  "built-in": "groups.builtIn",
  builtIn: "groups.builtIn",
  installed: "groups.installed",
  extra: "groups.extra",
};

function groupLabel(source: string, t: (key: string) => string): string {
  const key = SOURCE_GROUP_KEYS[source];
  if (key) return t(key);
  return t("groups.other");
}

function groupSkills(skills: SkillEntry[], t: (key: string) => string) {
  const map = new Map<string, { label: string; skills: SkillEntry[] }>();
  for (const skill of skills) {
    const label = groupLabel(skill.source, t);
    let group = map.get(label);
    if (!group) {
      group = { label, skills: [] };
      map.set(label, group);
    }
    group.skills.push(skill);
  }
  return [...map.values()];
}

export function SkillSelector(props: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation("chat");
  const { t: tc } = useTranslation("common");
  const skills = useAgentsStore(agentsSelectors.selectSkillEntries);
  const skillsRaw = useAgentsStore(agentsSelectors.selectSkills);
  const loadSkills = useAgentsStore((s) => s.loadSkills);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (skillsRaw === null) {
      void loadSkills();
    }
  }, [skillsRaw, loadSkills]);

  const groups = useMemo(
    () => groupSkills(skills, (k: string) => tc(`skillsPanel.${k}`)),
    [skills, tc],
  );

  const triggerText = props.value || t("sessionStrip.skill");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={props.disabled}>
        <button className={triggerCn}>
          <span className="max-w-[160px] truncate">{triggerText}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={tc("skillsPanel.filterPlaceholder")} />
          <CommandList>
            <CommandEmpty>{tc("skillsPanel.empty")}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  props.onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4", props.value ? "opacity-0" : "opacity-100")} />
                {t("sessionStrip.noSkill")}
              </CommandItem>
            </CommandGroup>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.skills.map((skill) => (
                  <CommandItem
                    key={skill.name}
                    value={skill.name}
                    keywords={[skill.description, skill.source]}
                    onSelect={() => {
                      props.onChange(skill.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        props.value === skill.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{skill.name}</div>
                      {skill.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {skill.description}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
