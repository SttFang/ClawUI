import type {
  SkillsListResult,
  WorkspaceListResult,
  WorkspaceReadFileResult,
  WorkspaceReadFileBase64Result,
  PythonRunResult,
} from "./types";
import { getElectronAPI } from "./types";

export const skills = {
  async list(): Promise<SkillsListResult> {
    const api = getElectronAPI();
    if (!api?.skills) throw new Error("Skills API not available — restart the app");
    return api.skills.list();
  },
};

export const workspace = {
  async list(subpath?: string): Promise<WorkspaceListResult> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.list(subpath);
  },
  async readFile(relativePath: string): Promise<WorkspaceReadFileResult> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.readFile(relativePath);
  },
  async readFileBase64(relativePath: string): Promise<WorkspaceReadFileBase64Result> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.readFileBase64(relativePath);
  },
  async runPython(relativePath: string): Promise<PythonRunResult> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.runPython(relativePath);
  },
  async openInSystem(relativePath: string): Promise<string> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.openInSystem(relativePath);
  },
};
