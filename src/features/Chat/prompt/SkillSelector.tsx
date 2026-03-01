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
import { Check, ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

// 稳定的颜色池 — 根据名称 hash 分配
const BADGE_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
] as const;

function badgeColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return BADGE_COLORS[((h % BADGE_COLORS.length) + BADGE_COLORS.length) % BADGE_COLORS.length];
}

export function SkillSelector(props: {
  value: string[];
  onChange: (value: string[]) => void;
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

  const selected = new Set(props.value);

  const toggle = useCallback(
    (name: string) => {
      if (selected.has(name)) {
        props.onChange(props.value.filter((n) => n !== name));
      } else {
        props.onChange([...props.value, name]);
      }
    },
    [props, selected],
  );

  const remove = useCallback(
    (name: string) => {
      props.onChange(props.value.filter((n) => n !== name));
    },
    [props],
  );

  return (
    <div className="flex min-w-0 items-center gap-1">
      {props.value.map((name) => (
        <span
          key={name}
          className={cn(
            "inline-flex max-w-[120px] items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
            badgeColor(name),
          )}
        >
          <span className="truncate">{name}</span>
          <button
            type="button"
            className="shrink-0 rounded-full p-px hover:opacity-70"
            onClick={() => remove(name)}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={props.disabled}>
          <button className={triggerCn}>
            <span className="truncate">
              {props.value.length === 0 ? t("sessionStrip.skill") : "+"}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={tc("skillsPanel.filterPlaceholder")} />
            <CommandList>
              <CommandEmpty>{tc("skillsPanel.empty")}</CommandEmpty>
              {props.value.length > 0 && (
                <CommandGroup>
                  <CommandItem
                    value="__clear_all__"
                    onSelect={() => {
                      props.onChange([]);
                      setOpen(false);
                    }}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                    {t("sessionStrip.clearSkills")}
                  </CommandItem>
                </CommandGroup>
              )}
              {groups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.skills.map((skill) => (
                    <CommandItem
                      key={skill.name}
                      value={skill.name}
                      keywords={[skill.description, skill.source]}
                      onSelect={() => toggle(skill.name)}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          selected.has(skill.name) ? "opacity-100" : "opacity-0",
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
    </div>
  );
}
