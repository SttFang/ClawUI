import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, vi } from "vitest";
import { useDialogForm } from "../useDialogForm";

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

describe("useDialogForm", () => {
  it("should keep local edits when config reference changes but values stay the same", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const snapshots: string[] = [];
    let renderError: unknown = null;
    const onSave = vi.fn(async () => {});

    const Probe = () => {
      const [tick, setTick] = useState(0);
      const { fields, setField } = useDialogForm({
        config: {
          botToken: "token-1",
          label: "",
          requireMention: true,
        },
        defaults: {
          botToken: "",
          label: "",
          requireMention: false,
        },
        onSave,
      });

      snapshots.push(`${tick}:${fields.label}`);

      useEffect(() => {
        if (tick === 0) {
          setField("label", "edited-value");
          setTick(1);
        }
      }, [setField, tick]);

      return null;
    };

    try {
      await act(async () => {
        root.render(createElement(Probe));
        await Promise.resolve();
      });
    } catch (error) {
      renderError = error;
    }

    expect(renderError).toBeNull();
    expect(snapshots.at(-1)).toBe("1:edited-value");
    expect(snapshots.length).toBeLessThan(10);

    act(() => {
      root.unmount();
    });
  });
});
