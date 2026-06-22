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

export interface TraceOptions<T = unknown> {
  /**
   * Extract token count and cost from the step output.
   * Takes priority over automatic detection.
   * If omitted, the SDK tries to sniff usage from well-known LLM response
   * shapes (Anthropic, OpenAI-compatible). Falls back to null if neither works.
   */
  extract?: (output: T) => { token_count?: number; cost_usd?: number };
}

export interface RunOptions {
  label?: string;
  input?: unknown;
  projectSlug: string;
  /**
   * ID of an existing Golden to run against.
   * When provided, the Golden's input, goal, expectedOutput, successCriteria,
   * traceAssertions, failureModes, and expectedBehavior are all used automatically.
   * Any field you also provide explicitly here overrides the Golden's value.
   */
  goldenId?: string;
  /** Plain-language description of what this run should accomplish. Used by the grader to score goal_completion accurately. */
  goal?: string;
  /** The correct/expected output for this run. When provided, the grader compares actual output against this to score output_quality. */
  expectedOutput?: unknown;
  /** Step-by-step description of what a correct agent execution looks like. Informs all five grading axes. */
  expectedBehavior?: string;
  /** Explicit checklist evaluated one-for-one in criteria_results. Overrides the grader inferring criteria from goal prose. */
  successCriteria?: string[];
  /** Deterministic trace assertions evaluated before LLM grading: must_call:<name>, must_not_call:<name>, max_steps:<n>, min_steps:<n>. */
  traceAssertions?: string[];
  /** Known failure modes to penalise if observed in the trace. */
  failureModes?: string[];
  /** Optional metadata for filtering and grouping. */
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
