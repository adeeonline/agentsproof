import { AgentRun } from './run';

/** Convenience wrapper for tracing an LLM call. */
export function traceLlm<T>(run: AgentRun, name: string, fn: () => Promise<T>, input?: unknown): Promise<T> {
  return run.trace('llm_call', name, fn, input);
}

/** Convenience wrapper for tracing a tool call. */
export function traceTool<T>(run: AgentRun, name: string, fn: () => Promise<T>, input?: unknown): Promise<T> {
  return run.trace('tool_call', name, fn, input);
}
