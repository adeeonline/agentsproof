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
  /** Plain-language description of what this run should accomplish. Used by the grader to score goal_completion accurately. */
  goal?: string;
  /** The correct/expected output for this run. When provided, the grader compares actual output against this to score output_quality. */
  expectedOutput?: unknown;
  /** Optional metadata for filtering and grouping (e.g. goldenId, proofRunId). */
  metadata?: Record<string, unknown>;
}

export interface RunResult {
  runId: string;
  publicUrl: string;
}

export interface GoldenCase {
  id: string;
  name: string;
  input: unknown;
  goal?: string;
  expectedOutput?: unknown;
  expectedBehavior?: string;
  successCriteria?: string[];
  traceAssertions?: string[];
  customGraderIds?: string[];
}

export interface ProofSuiteHandlerContext {
  golden: GoldenCase;
  startRun: (options?: Partial<RunOptions>) => import('./run').AgentRun;
}

export interface RunProofSuiteOptions {
  projectSlug: string;
  suiteSlug: string;
  handler: (input: unknown, ctx: ProofSuiteHandlerContext) => Promise<unknown>;
}
