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

## Run against an existing Golden

Pass `goldenId` to use a Golden as the eval context. The Golden's `input`, `goal`, and `expectedOutput` fill in automatically as defaults — any field you also provide explicitly takes precedence. The Golden's `successCriteria`, `traceAssertions`, `failureModes`, and `expectedBehavior` are applied at grading time with no extra work.

```ts
const run = ap.startRun({
  projectSlug: 'my-coding-agent',
  goldenId: 'abc-123',           // all Golden context loaded automatically
  label: 'Ad-hoc run against Golden',
  // input is optional — auto-filled from the Golden when omitted
});

const result = await myAgent(run);
const { publicUrl } = await run.complete(result);
```

## Inline eval fields — no Golden required

Supply the full eval context directly to `startRun()` without creating a Golden in the dashboard. Useful for one-off runs or CI scripts.

```ts
const run = ap.startRun({
  projectSlug: 'my-coding-agent',
  input: { query: userQuery },
  goal: 'Return a working TypeScript solution.',
  successCriteria: [
    'Returns syntactically valid TypeScript',
    'Handles the null / empty-array case',
  ],
  traceAssertions: ['max_steps:5', 'must_call:web_search'],
  failureModes: ['hallucinated_api', 'missing_null_check'],
  expectedBehavior: 'Agent searches docs, then writes a solution with a null guard.',
});
```

## Proof Suites — regression testing

Group approved Goldens into a suite and run them against your agent to get a pass/fail report.

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

---

## API

### `new AgentsProof({ apiKey, baseUrl? })`
Create a client. Get your API key from the dashboard at [agentsproof.dev](https://agentsproof.dev).

### `client.startRun(options)` → `AgentRun`

| Option | Type | Required | Description |
|---|---|---|---|
| `projectSlug` | `string` | **yes** | Your project identifier |
| `input` | `unknown` | yes¹ | The initial input or prompt to the agent |
| `goldenId` | `string` | no | ID of an existing Golden. Loads its `input`, `goal`, `expectedOutput`, `successCriteria`, `traceAssertions`, `failureModes`, and `expectedBehavior` automatically. Explicit fields override Golden defaults. |
| `label` | `string` | no | Human-readable label shown in the dashboard run list |
| `goal` | `string` | no | What this run should accomplish. Drives `goal_completion` scoring. |
| `expectedOutput` | `unknown` | no | Reference output. Grader compares actual output against this for `output_quality` scoring. |
| `expectedBehavior` | `string` | no | Step-by-step description of a correct execution. Informs all 5 grading axes. |
| `successCriteria` | `string[]` | no | Explicit checklist evaluated one-for-one in `criteria_results`. Overrides LLM-inferred criteria from `goal`. |
| `traceAssertions` | `string[]` | no | Deterministic assertions: `must_call:<name>`, `must_not_call:<name>`, `max_steps:<n>`, `min_steps:<n>`. Free-text entries are sent to the LLM grader as extra criteria. |
| `failureModes` | `string[]` | no | Known bad outcomes. Grader penalises runs where these are observed. |
| `metadata` | `Record<string, unknown>` | no | Arbitrary key/value pairs for filtering and grouping in the dashboard. |

> ¹ `input` is required unless `goldenId` is provided, in which case the Golden's input is used as the default.

### `run.trace(type, name, fn, input?, options?)` → `Promise<T>`
Wrap any async function and auto-log it as a step with latency and output captured.

Token count and cost are captured automatically in priority order:

1. **`options.extract`** — your own extractor, called with the step output. Return `{ token_count?, cost_usd? }`.
2. **Auto-detection** — the SDK sniffs `output.usage` for Anthropic (`input_tokens + output_tokens`) and OpenAI-compatible (`total_tokens` or `prompt_tokens + completion_tokens`) shapes.
3. **null** — if neither works, both fields are omitted.

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
Manually log a step without wrapping a function. Step types: `llm_call` | `tool_call` | `tool_result` | `memory_read` | `memory_write`.

### `run.complete(output)` → `Promise<{ publicUrl }>`
Finish the run, trigger grading, and get back the public report URL.

### `client.runProofSuite(options)` → `Promise<ProofSuiteResult>`

| Option | Type | Required | Description |
|---|---|---|---|
| `projectSlug` | `string` | yes | Your project identifier |
| `suiteSlug` | `string` | yes | The suite slug from the dashboard |
| `handler` | `(input, ctx) => Promise<unknown>` | yes | Called once per Golden case. Use `ctx.startRun()` to create a traced run. |

The SDK never throws on logging failures — steps are fire-and-forget so the SDK cannot crash your agent.

---

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

**`criteria_results` — how the checklist is populated:**

| What you provide | What the grader receives | Result |
|---|---|---|
| `successCriteria: [...]` (from Golden or directly) | Explicit bullet list | One pass/fail entry per criterion |
| `goal` only (no `successCriteria`) | Free-text goal prose | Grader **infers** its own criteria from the goal text |
| Neither | Nothing | `criteria_results` is empty |

**`traceAssertions`** — structured patterns (`must_call:*`, `max_steps:*`, etc.) are evaluated deterministically before the LLM runs. Free-text entries are passed to the LLM grader as additional criteria.

**Providing a `goal` always improves accuracy.** Without it, the grader infers intent from the raw input alone.

Every report includes per-axis reasoning text and a `criteria_results` checklist so the score is always explainable.
