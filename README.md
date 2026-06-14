# agentsproof

Drop the SDK into your agent, define what "good" means, and get a shareable proof report.

## Install

```bash
npm install agentsproof
```

## Quick start — single run

```ts
import { AgentsProof } from 'agentsproof';

const ap = new AgentsProof({ apiKey: process.env.AGENTSPROOF_API_KEY! });

async function runMyAgent(userQuery: string) {
  const run = ap.startRun({
    projectSlug: 'my-coding-agent',
    label: 'Answer coding question',
    input: { query: userQuery },
    goal: 'Search the web for relevant docs and return a working code solution',
    expectedOutput: { code: '...', language: 'typescript' }, // optional
  });

  const plan = await run.trace('llm_call', 'gpt-4o', async () => {
    return await openai.chat.completions.create({ /* ... */ });
  }, { query: userQuery });

  const searchResults = await run.trace('tool_call', 'web_search', async () => {
    return await webSearch(plan);
  });

  const finalAnswer = await run.trace('llm_call', 'gpt-4o', async () => {
    return await openai.chat.completions.create({ /* ... */ });
  });

  const { publicUrl } = await run.complete({ answer: finalAnswer });
  console.log(`Report: ${publicUrl}`);
  // → https://agentsproof.dev/r/abc123
}
```

## Proof Suites — regression testing

Group approved Goldens into a suite and run them against your agent to get a pass/fail report. Each run compares against the previous one so regressions are caught immediately.

```ts
import { AgentsProof } from 'agentsproof';

const ap = new AgentsProof({ apiKey: process.env.AGENTSPROOF_API_KEY! });

await ap.runProofSuite({
  projectSlug: 'my-coding-agent',
  suiteSlug: 'core-behaviors',
  async handler(input, ctx) {
    // input comes from the approved Golden's stored input
    const run = ctx.startRun();
    const result = await myAgent(input);
    await run.complete({ answer: result });
  },
});
// → { passedCases: 17, failedCases: 1, overallScore: 0.91, publicUrl: '...' }
```

### Trace assertions

Each Golden can define `traceAssertions` in the dashboard — checked server-side after every proof run and displayed in the run's trace view.

**Structured assertions** are evaluated deterministically (no LLM involved):

| Pattern | What it checks |
|---|---|
| `must_call:tool_name` | At least one step must have `name == tool_name` |
| `must_not_call:tool_name` | No step may have `name == tool_name` |
| `max_steps:N` | Total step count must be ≤ N |
| `min_steps:N` | Total step count must be ≥ N |

**Free-text assertions** (anything not matching the patterns above) are passed to the LLM grader as extra criteria alongside `successCriteria`.

Set these in the dashboard when editing a Golden, one per line:
```
must_not_call:send_email
max_steps:10
Agent must ask for confirmation before any irreversible action
```

### Success criteria, expected behavior, and failure modes

These three Golden fields are now fed directly to the LLM grader as context, and the grader returns a per-criterion pass/fail result for each `successCriteria` entry:

- **Success criteria** — explicit pass/fail judgements returned per criterion, visible in the trace view
- **Expected behavior** — free-text description of what a correct agent run looks like; used to improve all 5 axis scores
- **Failure modes** — known bad outcomes to watch for; LLM penalises runs where these occur

All results appear in the **Golden checks** panel in the trace view, separate from the 5-axis score.

## API

### `new AgentsProof({ apiKey, baseUrl? })`
Create a client. Get your API key from the dashboard at [agentsproof.dev](https://agentsproof.dev).

### `client.startRun(options)` → `AgentRun`

| Option | Type | Required | Description |
|---|---|---|---|
| `projectSlug` | `string` | yes | Your project identifier |
| `input` | `unknown` | yes | The initial input or prompt to the agent |
| `label` | `string` | no | Human-readable label for this run |
| `goal` | `string` | no | What this run should accomplish. Used by the grader to score `goal_completion`. |
| `expectedOutput` | `unknown` | no | Expected output. When provided, grader compares actual output against this for `output_quality` scoring. |

### `run.trace(type, name, fn, input?, options?)` → `Promise<T>`
Wrap any async function and auto-log it as a step with latency and output captured.

Token count and cost are captured automatically in priority order:

1. **`options.extract`** — your own extractor, called with the step output. Return `{ token_count?, cost_usd? }`.
2. **Auto-detection** — if no extractor is given, the SDK sniffs `output.usage` for Anthropic (`input_tokens + output_tokens`) and OpenAI-compatible (`total_tokens` or `prompt_tokens + completion_tokens`) shapes.
3. **null** — if neither works, both fields are omitted from the step.

```ts
// Anthropic / OpenAI — auto-detected, no extra code needed
const result = await run.trace('llm_call', 'claude', () =>
  anthropic.messages.create({ model: 'claude-sonnet-4-6', /* ... */ })
);

// Any other provider — supply an extractor
const result = await run.trace('llm_call', 'my-model', () => callMyLLM(prompt), input, {
  extract: (out) => ({ token_count: out.usage.tokens, cost_usd: out.billed_usd }),
});
```

### `run.logStep(payload)`
Manually log a step. Step types: `llm_call` | `tool_call` | `tool_result` | `memory_read` | `memory_write`.

### `run.complete(output)` → `Promise<{ publicUrl }>`
Finish the run, trigger grading, and get back the public report URL.

### `client.runProofSuite(options)` → `Promise<ProofSuiteResult>`

| Option | Type | Required | Description |
|---|---|---|---|
| `projectSlug` | `string` | yes | Your project identifier |
| `suiteSlug` | `string` | yes | The suite slug from the dashboard |
| `handler` | `(input, ctx) => Promise<unknown>` | yes | Called once per Golden case. Use `ctx.startRun()` to create a traced run. |

The SDK never throws on logging failures — it's fire-and-forget so it can't crash your agent.

## How grading works

Each run is automatically scored on 5 axes:

| Axis | Weight | What it measures |
|---|---|---|
| Goal completion | 35% | Did the agent achieve the stated goal? |
| Output quality | 20% | Is the final output correct and complete? |
| Tool accuracy | 20% | Were tool calls well-formed and necessary? |
| Step efficiency | 15% | Did it avoid redundant steps or loops? |
| Safety | 10% | Did it avoid unsafe or off-policy actions? |

**Weights adjust automatically** — if your agent makes no tool calls, `tool_accuracy` weight is redistributed to `goal_completion` and `output_quality`.

**When the run is part of a Proof Suite**, the grader is also given the linked Golden's `successCriteria`, `expectedBehavior`, and `failureModes` as context, making scoring significantly more accurate. Structured `traceAssertions` (`must_call:*`, `max_steps:*`, etc.) are evaluated deterministically before the LLM runs. All results appear as a **Golden checks** panel in the trace view alongside the standard 5-axis scores.

**Providing a `goal` always improves accuracy.** Without it, the judge infers intent from the raw input.

Every report includes per-axis reasoning text so the score is always explainable.
