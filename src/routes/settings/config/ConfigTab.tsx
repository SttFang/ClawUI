import { Button } from "@clawui/ui";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  CONFIG_SECTIONS,
  resolveConfigSection,
  type ConfigSection,
} from "@/router/settingsRouteSchema";
import { ChannelsSection } from "./ChannelsSection";
import { PluginsSection } from "./PluginsSection";
import { SkillsSection } from "./SkillsSection";
import { ToolsSection } from "./ToolsSection";

const sectionLabelKeys: Record<ConfigSection, string> = {
  channels: "channels.title",
  tools: "tools.title",
  skills: "agents.sections.skills.title",
  plugins: "plugins.title",
};

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
    () => resolveConfigSection(activeSection),
    [activeSection],
  );

  useEffect(() => {
    const element = sectionRefs.current[selectedSection];
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedSection]);

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
        {CONFIG_SECTIONS.map((section) => (
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
        {CONFIG_SECTIONS.map((section, index) => (
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
