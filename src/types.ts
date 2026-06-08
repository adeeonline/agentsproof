export type StepType =
  | 'llm_call'
  | 'tool_call'
  | 'tool_result'
  | 'memory_read'
  | 'memory_write';

export interface StepPayload {
  type: StepType;
  name?: string;
  input?: unknown;
  output?: unknown;
  latency_ms?: number;
  token_count?: number;
  cost_usd?: number;
}

export interface RunOptions {
  label?: string;
  input: unknown;
  projectSlug: string;
}

export interface RunResult {
  runId: string;
  publicUrl: string;
}
