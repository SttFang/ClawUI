import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWorkspaceFilesStore, classifyFile, guessMimeType, guessLanguage } from "../index";

// Mock ipc
vi.mock("@/lib/ipc", () => ({
  ipc: {
    workspace: {
      list: vi.fn(),
      readFile: vi.fn(),
      readFileBase64: vi.fn(),
      runPython: vi.fn(),
    },
  },
}));

// Get mocked ipc after vi.mock
import { ipc } from "@/lib/ipc";
const mockIpc = vi.mocked(ipc.workspace);

function resetStore() {
  useWorkspaceFilesStore.setState({
    files: [],
    currentPath: "",
    openTabs: [],
    activeTabPath: null,
    loading: false,
    error: null,
    pythonResult: null,
    pythonRunning: false,
  });
}

describe("classifyFile", () => {
  it("classifies image files", () => {
    expect(classifyFile("photo.png")).toBe("image");
    expect(classifyFile("icon.SVG")).toBe("image");
    expect(classifyFile("pic.jpeg")).toBe("image");
  });

  it("classifies html files", () => {
    expect(classifyFile("page.html")).toBe("html");
    expect(classifyFile("index.htm")).toBe("html");
  });

  it("classifies office files", () => {
    expect(classifyFile("report.docx")).toBe("office");
    expect(classifyFile("slides.pptx")).toBe("office");
    expect(classifyFile("paper.pdf")).toBe("office");
  });

  it("classifies video files", () => {
    expect(classifyFile("clip.mp4")).toBe("video");
    expect(classifyFile("demo.webm")).toBe("video");
    expect(classifyFile("screen.mov")).toBe("video");
    expect(classifyFile("audio.ogg")).toBe("video");
  });

  it("classifies text files", () => {
    expect(classifyFile("main.py")).toBe("text");
    expect(classifyFile("readme.md")).toBe("text");
    expect(classifyFile("data.json")).toBe("text");
    expect(classifyFile("noext")).toBe("text");
  });
});

describe("guessMimeType", () => {
  it("returns correct MIME types for images", () => {
    expect(guessMimeType("a.png")).toBe("image/png");
    expect(guessMimeType("b.jpg")).toBe("image/jpeg");
    expect(guessMimeType("c.svg")).toBe("image/svg+xml");
  });

  it("returns correct MIME types for office files", () => {
    expect(guessMimeType("a.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(guessMimeType("b.pptx")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    expect(guessMimeType("c.pdf")).toBe("application/pdf");
  });

  it("returns correct MIME types for video files", () => {
    expect(guessMimeType("a.mp4")).toBe("video/mp4");
    expect(guessMimeType("b.webm")).toBe("video/webm");
    expect(guessMimeType("c.mov")).toBe("video/quicktime");
    expect(guessMimeType("d.ogg")).toBe("video/ogg");
  });

  it("returns fallback for unknown extensions", () => {
    expect(guessMimeType("file.xyz")).toBe("application/octet-stream");
  });
});

describe("guessLanguage", () => {
  it("maps known extensions to languages", () => {
    expect(guessLanguage("app.ts")).toBe("typescript");
    expect(guessLanguage("main.py")).toBe("python");
    expect(guessLanguage("style.css")).toBe("css");
  });

  it("returns null for unknown extensions", () => {
    expect(guessLanguage("file.xyz")).toBeNull();
    expect(guessLanguage("noext")).toBeNull();
  });
});

describe("openFile", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("opens a text file as a new tab", async () => {
    mockIpc.readFile.mockResolvedValue({ path: "/ws/test.md", content: "# Hello" });

    await useWorkspaceFilesStore.getState().openFile("test.md");

    const { openTabs, activeTabPath } = useWorkspaceFilesStore.getState();
    expect(openTabs).toHaveLength(1);
    expect(openTabs[0].relativePath).toBe("test.md");
    expect(openTabs[0].name).toBe("test.md");
    expect(openTabs[0].kind).toBe("text");
    expect(openTabs[0].content).toBe("# Hello");
    expect(openTabs[0].loading).toBe(false);
    expect(activeTabPath).toBe("test.md");
  });

  it("opens an image file with base64 content", async () => {
    mockIpc.readFileBase64.mockResolvedValue({ path: "/ws/pic.png", base64: "abc123" });

    await useWorkspaceFilesStore.getState().openFile("pic.png");

    const { openTabs } = useWorkspaceFilesStore.getState();
    expect(openTabs[0].kind).toBe("image");
    expect(openTabs[0].content).toBe("data:image/png;base64,abc123");
  });

  it("opens an office file with base64 content", async () => {
    mockIpc.readFileBase64.mockResolvedValue({
      path: "/ws/slides.pptx",
      base64: "xyz999",
    });

    await useWorkspaceFilesStore.getState().openFile("slides.pptx");

    const { openTabs } = useWorkspaceFilesStore.getState();
    expect(openTabs[0].kind).toBe("office");
    expect(openTabs[0].content).toBe(
      "data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,xyz999",
    );
    expect(mockIpc.readFile).not.toHaveBeenCalled();
  });

  it("switches to existing tab instead of opening duplicate", async () => {
    mockIpc.readFile.mockResolvedValue({ path: "/ws/a.txt", content: "hello" });

    await useWorkspaceFilesStore.getState().openFile("a.txt");
    // Open a second file
    mockIpc.readFile.mockResolvedValue({ path: "/ws/b.txt", content: "world" });
    await useWorkspaceFilesStore.getState().openFile("b.txt");
    expect(useWorkspaceFilesStore.getState().activeTabPath).toBe("b.txt");

    // Re-open first file: should switch, not duplicate
    await useWorkspaceFilesStore.getState().openFile("a.txt");

    const { openTabs, activeTabPath } = useWorkspaceFilesStore.getState();
    expect(openTabs).toHaveLength(2);
    expect(activeTabPath).toBe("a.txt");
  });

  it("sets error on load failure", async () => {
    mockIpc.readFile.mockRejectedValue(new Error("ENOENT"));

    await useWorkspaceFilesStore.getState().openFile("missing.txt");

    const tab = useWorkspaceFilesStore.getState().openTabs[0];
    expect(tab.error).toBe("ENOENT");
    expect(tab.loading).toBe(false);
  });
});

describe("closeTab", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("closes the active tab and switches to neighbor", async () => {
    mockIpc.readFile.mockImplementation(async (path: string) => ({ path, content: path }));

    const store = useWorkspaceFilesStore.getState();
    await store.openFile("a.txt");
    await store.openFile("b.txt");
    await store.openFile("c.txt");
    expect(useWorkspaceFilesStore.getState().activeTabPath).toBe("c.txt");

    useWorkspaceFilesStore.getState().closeTab("c.txt");

    const { openTabs, activeTabPath } = useWorkspaceFilesStore.getState();
    expect(openTabs).toHaveLength(2);
    expect(activeTabPath).toBe("b.txt");
  });

  it("closing last tab results in null activeTabPath", async () => {
    mockIpc.readFile.mockResolvedValue({ path: "/ws/a.txt", content: "" });
    await useWorkspaceFilesStore.getState().openFile("a.txt");

    useWorkspaceFilesStore.getState().closeTab("a.txt");

    const { openTabs, activeTabPath } = useWorkspaceFilesStore.getState();
    expect(openTabs).toHaveLength(0);
    expect(activeTabPath).toBeNull();
  });

  it("closing non-active tab preserves active", async () => {
    mockIpc.readFile.mockImplementation(async (path: string) => ({ path, content: path }));

    await useWorkspaceFilesStore.getState().openFile("a.txt");
    await useWorkspaceFilesStore.getState().openFile("b.txt");
    // Active is b.txt
    useWorkspaceFilesStore.getState().closeTab("a.txt");

    expect(useWorkspaceFilesStore.getState().activeTabPath).toBe("b.txt");
    expect(useWorkspaceFilesStore.getState().openTabs).toHaveLength(1);
  });
});

describe("runPython", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("stores python result on success", async () => {
    mockIpc.runPython.mockResolvedValue({ stdout: "42\n", stderr: "", exitCode: 0 });

    await useWorkspaceFilesStore.getState().runPython("script.py");

    const { pythonResult, pythonRunning } = useWorkspaceFilesStore.getState();
    expect(pythonRunning).toBe(false);
    expect(pythonResult).toEqual({ stdout: "42\n", stderr: "", exitCode: 0 });
  });

  it("stores error result on failure", async () => {
    mockIpc.runPython.mockRejectedValue(new Error("python3 not found"));

    await useWorkspaceFilesStore.getState().runPython("script.py");

    const { pythonResult, pythonRunning } = useWorkspaceFilesStore.getState();
    expect(pythonRunning).toBe(false);
    expect(pythonResult?.stderr).toBe("python3 not found");
    expect(pythonResult?.exitCode).toBe(1);
  });
});
