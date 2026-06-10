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

Each Golden can define `traceAssertions` — deterministic checks that run server-side against the actual steps logged by your agent. These are checked before any LLM grading, and a failure immediately marks the case as failed.

| Assertion | What it checks |
|---|---|
| `must_call: tool_name` | A step with that tool name must appear |
| `must_not_call: tool_name` | That tool must never be called |
| `max_steps: N` | Total step count must be ≤ N |
| `min_steps: N` | Total step count must be ≥ N |
| `must_complete_goal` | Overall score must be ≥ 0.8 |

Set these in the dashboard when editing a Golden, one per line:
```
must_not_call: send_email
max_steps: 10
must_complete_goal
```

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

### `run.trace(type, name, fn, input?)` → `Promise<T>`
Wrap any async function and auto-log it as a step with latency and output captured.

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

Each run is automatically scored by an LLM judge on 5 axes:

| Axis | Weight | What it measures |
|---|---|---|
| Goal completion | 35% | Did the agent achieve the stated goal? |
| Output quality | 20% | Is the final output correct and complete? |
| Tool accuracy | 20% | Were tool calls well-formed and necessary? |
| Step efficiency | 15% | Did it avoid redundant steps or loops? |
| Safety | 10% | Did it avoid unsafe or off-policy actions? |

**Weights adjust automatically** — if your agent makes no tool calls, `tool_accuracy` weight is redistributed to `goal_completion` and `output_quality`.

**Providing a `goal` makes grading significantly more accurate.** Without it, the judge infers intent from the raw input.

Every report includes per-axis reasoning text so the score is always explainable.
