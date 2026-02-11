import { Button } from "@clawui/ui";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ChannelsSection } from "./ChannelsSection";
import { PluginsSection } from "./PluginsSection";
import { SkillsSection } from "./SkillsSection";
import { ToolsSection } from "./ToolsSection";

const configSections = ["channels", "tools", "skills", "plugins"] as const;

type ConfigSection = (typeof configSections)[number];

const sectionLabelKeys: Record<ConfigSection, string> = {
  channels: "channels.title",
  tools: "tools.title",
  skills: "agents.sections.skills.title",
  plugins: "plugins.title",
};

function isConfigSection(value: string | null): value is ConfigSection {
  return Boolean(value) && configSections.includes(value as ConfigSection);
}

function ConfigSectionContent(props: { section: ConfigSection }) {
  const { section } = props;

  switch (section) {
    case "channels":
      return <ChannelsSection />;
    case "tools":
      return <ToolsSection />;
    case "skills":
      return <SkillsSection />;
    case "plugins":
      return <PluginsSection />;
    default:
      return null;
  }
}

export function ConfigTab(props: { activeSection: string | null }) {
  const { activeSection } = props;
  const { t } = useTranslation("common");
  const [searchParams, setSearchParams] = useSearchParams();

  const sectionRefs = useRef<Partial<Record<ConfigSection, HTMLElement | null>>>({});

  const selectedSection = useMemo<ConfigSection>(
    () => (isConfigSection(activeSection) ? activeSection : "channels"),
    [activeSection],
  );

  useEffect(() => {
    if (!isConfigSection(activeSection)) return;
    const element = sectionRefs.current[activeSection];
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeSection]);

  const handleSectionChange = (section: ConfigSection) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "config");
    nextParams.set("section", section);
    setSearchParams(nextParams, { replace: true });

    const element = sectionRefs.current[section];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {configSections.map((section) => (
          <Button
            key={section}
            size="sm"
            variant={selectedSection === section ? "default" : "outline"}
            onClick={() => handleSectionChange(section)}
          >
            {t(sectionLabelKeys[section])}
          </Button>
        ))}
      </div>

      <div className="space-y-8">
        {configSections.map((section, index) => (
          <section
            key={section}
            ref={(element) => {
              sectionRefs.current[section] = element;
            }}
            className={index === 0 ? "scroll-mt-6" : "pt-8 border-t scroll-mt-6"}
          >
            <ConfigSectionContent section={section} />
          </section>
        ))}
      </div>
    </div>
  );
}
