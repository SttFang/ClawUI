import type { BrowserWindowConstructorOptions } from "electron";

export const TITLE_BAR_HEIGHT = 44;
const TRAFFIC_LIGHTS_HEIGHT = 14;
const TRAFFIC_LIGHTS_X = 20;
const TRAFFIC_LIGHTS_Y = TITLE_BAR_HEIGHT / 2 - TRAFFIC_LIGHTS_HEIGHT / 2;

type WindowChromeOptions = Pick<
  BrowserWindowConstructorOptions,
  "titleBarStyle" | "trafficLightPosition" | "titleBarOverlay"
>;

export function buildWindowChromeOptions(platform: NodeJS.Platform): WindowChromeOptions {
  if (platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: TRAFFIC_LIGHTS_X, y: TRAFFIC_LIGHTS_Y },
    };
  }

  return {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#94A3B8",
      height: TITLE_BAR_HEIGHT,
    },
  };
}
