import { nanoid } from 'nanoid';
import { StepPayload, RunOptions } from './types';

interface RunInternalOptions extends RunOptions {
  apiKey: string;
  baseUrl: string;
}

export class AgentRun {
  public runId: string;
  private steps: (StepPayload & { step_index: number; created_at: string })[] = [];
  private startedAt: number;
  private opts: RunInternalOptions;
  private remoteRunId: string | null = null;
  private initPromise: Promise<void>;

  constructor(opts: RunInternalOptions) {
    this.opts = opts;
    this.runId = nanoid(12);
    this.startedAt = Date.now();
    this.initPromise = this._initRemote();
  }

  private async _initRemote() {
    const res = await fetch(`${this.opts.baseUrl}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.opts.apiKey,
      },
      body: JSON.stringify({
        label: this.opts.label,
        input: this.opts.input,
        projectSlug: this.opts.projectSlug,
        clientRunId: this.runId,
        goal: this.opts.goal,
        expectedOutput: this.opts.expectedOutput,
        metadata: this.opts.metadata ?? {},
      }),
    });
    if (!res.ok) throw new Error(`AgentsProof: failed to init run — ${res.status}`);
    const data = await res.json();
    this.remoteRunId = data.runId;
  }

  /** Log any step — tool call, LLM call, memory op, etc. */
  async logStep(payload: StepPayload): Promise<void> {
    await this.initPromise;
    const step = {
      ...payload,
      step_index: this.steps.length,
      created_at: new Date().toISOString(),
    };
    this.steps.push(step);
    // Fire-and-forget to keep agent path fast
    fetch(`${this.opts.baseUrl}/runs/${this.remoteRunId}/steps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.opts.apiKey,
      },
      body: JSON.stringify(step),
    }).catch(() => {}); // SDK must never crash the agent
  }

  /** Wrap an async function and auto-log it as a step */
  async trace<T>(
    type: StepPayload['type'],
    name: string,
    fn: () => Promise<T>,
    inputPayload?: unknown
  ): Promise<T> {
    const t0 = Date.now();
    let output: T;
    try {
      output = await fn();
    } catch (err) {
      await this.logStep({ type, name, input: inputPayload, output: { error: String(err) }, latency_ms: Date.now() - t0 });
      throw err;
    }
    await this.logStep({ type, name, input: inputPayload, output, latency_ms: Date.now() - t0 });
    return output;
  }

  /** Finish the run and trigger grading. Returns the public report URL. */
  async complete(output: unknown): Promise<{ publicUrl: string }> {
    await this.initPromise;
    const res = await fetch(`${this.opts.baseUrl}/runs/${this.remoteRunId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.opts.apiKey,
      },
      body: JSON.stringify({ output }),
    });
    if (!res.ok) throw new Error(`AgentsProof: failed to complete run — ${res.status}`);
    const data = await res.json();
    return { publicUrl: data.publicUrl };
  }

  async getRemoteId(): Promise<string | null> {
    await this.initPromise;
    return this.remoteRunId;
  }

  get elapsedMs() {
    return Date.now() - this.startedAt;
  }
}
