# agentsproof

Drop one decorator into your agent, get a shareable eval report card with a public URL.

## Install

```bash
npm install agentsproof
```

## Usage

```ts
import { AgentProof } from 'agentsproof';

const ap = new AgentProof({ apiKey: process.env.AGENTPROOF_API_KEY! });

async function runMyAgent(userQuery: string) {
  const run = ap.startRun({
    projectSlug: 'my-coding-agent',
    label: 'Answer coding question',
    input: { query: userQuery },
  });

  // Wrap LLM calls
  const plan = await run.trace('llm_call', 'gpt-4o', async () => {
    return await openai.chat.completions.create({ /* ... */ });
  }, { query: userQuery });

  // Wrap tool calls
  const searchResults = await run.trace('tool_call', 'web_search', async () => {
    return await webSearch(plan);
  });

  const finalAnswer = await run.trace('llm_call', 'gpt-4o', async () => {
    return await openai.chat.completions.create({ /* ... */ });
  });

  // Complete — triggers auto-grading, returns public URL
  const { publicUrl } = await run.complete({ answer: finalAnswer });
  console.log(`Report: ${publicUrl}`);
  // → https://agentproof.dev/r/abc123xyz
}
```

## API

- `new AgentProof({ apiKey, baseUrl? })` — create a client.
- `client.startRun({ projectSlug, label?, input })` — start a run, returns an `AgentRun`.
- `run.trace(type, name, fn, input?)` — wrap an async function, auto-logs latency/output as a step.
- `run.logStep(payload)` — manually log a step (`llm_call` | `tool_call` | `tool_result` | `memory_read` | `memory_write`).
- `run.complete(output)` — finish the run, triggers grading, returns `{ publicUrl }`.

The SDK never throws on logging failures — it's fire-and-forget so it can't crash your agent.
