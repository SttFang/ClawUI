import type { CronStatus, CronJob, CronRunsEntry } from "../../types";

export interface CronState {
  cronStatus: CronStatus | null;
  cronJobs: CronJob[] | null;
  cronError: string | null;
  cronBusyJobId: string | null;
  cronRunsData: { jobId: string; entries: CronRunsEntry[] } | null;
}

export const initialCronState: CronState = {
  cronStatus: null,
  cronJobs: null,
  cronError: null,
  cronBusyJobId: null,
  cronRunsData: null,
};
