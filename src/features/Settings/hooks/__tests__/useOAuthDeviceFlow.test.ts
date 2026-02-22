import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOAuthDeviceFlow, type OAuthDeviceFlowPhase } from "../useOAuthDeviceFlow";

if (typeof globalThis !== "undefined") {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

/* ── mocks ── */

const mockCopy = vi.fn();
vi.mock("@/hooks/useClipboard", () => ({
  useClipboard: () => ({ copied: false, copy: mockCopy }),
}));

const mockOauthDeviceStart = vi.fn();
const mockOauthDevicePoll = vi.fn();
vi.mock("@/lib/ipc", () => ({
  ipc: {
    credentials: {
      oauthDeviceStart: (...a: unknown[]) => mockOauthDeviceStart(...a),
      oauthDevicePoll: (...a: unknown[]) => mockOauthDevicePoll(...a),
    },
  },
}));

/* ── helpers ── */

type HookReturn = ReturnType<typeof useOAuthDeviceFlow>;

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(opts?: { onSuccess?: () => void }) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const onOpenChange = vi.fn();
  const onSuccess = opts?.onSuccess ?? vi.fn();
  const phases: OAuthDeviceFlowPhase[] = [];
  let latest!: HookReturn;

  const Probe = () => {
    const result = useOAuthDeviceFlow({
      provider: "github",
      onSuccess,
      onOpenChange,
    });
    latest = result;
    phases.push(result.phase);
    return null;
  };

  act(() => {
    root.render(createElement(Probe));
  });

  return {
    get latest() {
      return latest;
    },
    phases,
    root,
    onOpenChange,
    onSuccess,
    rerender() {
      act(() => root.render(createElement(Probe)));
    },
    unmount() {
      act(() => root.unmount());
    },
  };
}

/* ── tests ── */

beforeEach(() => {
  vi.clearAllMocks();
});

const DEVICE_INFO = {
  userCode: "ABCD-1234",
  verificationUri: "https://github.com/login/device",
  deviceCode: "dc_xxx",
  interval: 5,
};

describe("useOAuthDeviceFlow", () => {
  describe("startFlow success path", () => {
    it("idle → requesting → waiting → success", async () => {
      const startDef = deferred<typeof DEVICE_INFO>();
      const pollDef = deferred<void>();
      mockOauthDeviceStart.mockReturnValue(startDef.promise);
      mockOauthDevicePoll.mockReturnValue(pollDef.promise);

      const h = setup();
      expect(h.latest.phase).toBe("idle");

      // kick off flow
      let flowPromise: Promise<void>;
      act(() => {
        flowPromise = h.latest.startFlow();
      });
      h.rerender();
      expect(h.latest.phase).toBe("requesting");

      // resolve device start
      await act(async () => {
        startDef.resolve(DEVICE_INFO);
        await startDef.promise;
      });
      h.rerender();
      expect(h.latest.phase).toBe("waiting");
      expect(h.latest.userCode).toBe("ABCD-1234");
      expect(h.latest.verificationUri).toBe("https://github.com/login/device");

      // resolve poll
      await act(async () => {
        pollDef.resolve();
        await flowPromise!;
      });
      h.rerender();
      expect(h.latest.phase).toBe("success");

      h.unmount();
    });

    it("calls onSuccess after success", async () => {
      const onSuccess = vi.fn();
      mockOauthDeviceStart.mockResolvedValue(DEVICE_INFO);
      mockOauthDevicePoll.mockResolvedValue(undefined);

      const h = setup({ onSuccess });

      await act(async () => {
        await h.latest.startFlow();
      });
      h.rerender();

      expect(h.latest.phase).toBe("success");
      expect(onSuccess).toHaveBeenCalledOnce();

      h.unmount();
    });
  });

  describe("startFlow error path", () => {
    it("oauthDeviceStart throws → error phase + errorMessage", async () => {
      mockOauthDeviceStart.mockRejectedValue(new Error("network down"));

      const h = setup();

      await act(async () => {
        await h.latest.startFlow();
      });
      h.rerender();

      expect(h.latest.phase).toBe("error");
      expect(h.latest.errorMessage).toBe("network down");

      h.unmount();
    });

    it("oauthDevicePoll throws → error phase (keeps userCode)", async () => {
      mockOauthDeviceStart.mockResolvedValue(DEVICE_INFO);
      mockOauthDevicePoll.mockRejectedValue(new Error("expired_token"));

      const h = setup();

      await act(async () => {
        await h.latest.startFlow();
      });
      h.rerender();

      expect(h.latest.phase).toBe("error");
      expect(h.latest.errorMessage).toBe("expired_token");
      expect(h.latest.userCode).toBe("ABCD-1234");

      h.unmount();
    });
  });
});
