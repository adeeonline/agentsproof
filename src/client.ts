import { RunOptions } from './types';
import { AgentRun } from './run';

export class AgentProof {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://agentproof.dev/api';
  }

  startRun(options: RunOptions): AgentRun {
    return new AgentRun({
      ...options,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    });
  }
}
