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
  async list(subpath?: string, agentId?: string): Promise<WorkspaceListResult> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.list(subpath, agentId);
  },
  async readFile(relativePath: string, agentId?: string): Promise<WorkspaceReadFileResult> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.readFile(relativePath, agentId);
  },
  async readFileBase64(
    relativePath: string,
    agentId?: string,
  ): Promise<WorkspaceReadFileBase64Result> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.readFileBase64(relativePath, agentId);
  },
  async runPython(relativePath: string, agentId?: string): Promise<PythonRunResult> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.runPython(relativePath, agentId);
  },
  async openInSystem(relativePath: string, agentId?: string): Promise<string> {
    const api = getElectronAPI();
    if (!api?.workspace) throw new Error("Workspace API not available — restart the app");
    return api.workspace.openInSystem(relativePath, agentId);
  },
};
