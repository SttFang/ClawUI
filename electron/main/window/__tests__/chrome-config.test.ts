import { describe, expect, it } from "vitest";
import { TITLE_BAR_HEIGHT, buildWindowChromeOptions } from "../chrome-config";

describe("buildWindowChromeOptions", () => {
  it("should return macOS hiddenInset title bar options", () => {
    const options = buildWindowChromeOptions("darwin");

    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.trafficLightPosition).toEqual({ x: 20, y: 15 });
    expect(options.titleBarOverlay).toBeUndefined();
  });

  it("should return titleBarOverlay config for windows", () => {
    const options = buildWindowChromeOptions("win32");

    expect(options.titleBarStyle).toBe("hidden");
    expect(options.titleBarOverlay).toEqual({
      color: "#00000000",
      symbolColor: "#94A3B8",
      height: TITLE_BAR_HEIGHT,
    });
  });

  it("should fallback to titleBarOverlay for linux", () => {
    const options = buildWindowChromeOptions("linux");

    expect(options.titleBarStyle).toBe("hidden");
    expect(options.titleBarOverlay).toBeDefined();
  });
});
