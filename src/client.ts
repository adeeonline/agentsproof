import { RunOptions, RunProofSuiteOptions } from './types';
import { AgentRun } from './run';
import { runProofSuite } from './proof-suite';

export class AgentsProof {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://www.agentsproof.dev/api';
  }

  startRun(options: RunOptions): AgentRun {
    return new AgentRun({
      ...options,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    });
  }

  /** Runs approved Goldens locally against the developer's agent. AgentsProof never executes user code remotely. */
  async runProofSuite(options: RunProofSuiteOptions) {
    return runProofSuite({
      ...options,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    });
  }
}
