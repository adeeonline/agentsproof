import { AgentRun } from './run';
import { GoldenCase, RunProofSuiteOptions } from './types';

interface InternalOptions extends RunProofSuiteOptions {
  apiKey: string;
  baseUrl: string;
}

export async function runProofSuite(opts: InternalOptions) {
  const casesRes = await fetch(
    `${opts.baseUrl}/proof-suites/${opts.suiteSlug}/cases?projectSlug=${encodeURIComponent(opts.projectSlug)}`,
    { headers: { 'x-api-key': opts.apiKey } }
  );

  if (!casesRes.ok) throw new Error(`AgentsProof: failed to load proof suite — ${casesRes.status}`);
  const { proofRunId, cases } = await casesRes.json() as { proofRunId: string; cases: GoldenCase[] };

  for (const golden of cases) {
    let runId: string | null = null;
    let score: number | null = null;
    let passed = false;
    let failureSummary: string | null = null;

    try {
      let handlerRun: AgentRun | null = null;

      await opts.handler(golden.input, {
        golden,
        startRun: (overrides = {}) => {
          const run = new AgentRun({
            projectSlug: opts.projectSlug,
            label: overrides.label ?? `Proof case: ${golden.name}`,
            input: overrides.input ?? golden.input,
            goal: overrides.goal ?? golden.goal,
            expectedOutput: overrides.expectedOutput ?? golden.expectedOutput,
            metadata: { ...(overrides.metadata ?? {}), goldenId: golden.id, proofRunId },
            apiKey: opts.apiKey,
            baseUrl: opts.baseUrl,
          });
          handlerRun = run;
          return run;
        },
      });

      runId = handlerRun ? await (handlerRun as AgentRun).getRemoteId() : null;
      passed = true;
    } catch (err) {
      failureSummary = String(err);
    }

    await fetch(`${opts.baseUrl}/proof-runs/${proofRunId}/case-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey },
      body: JSON.stringify({ goldenId: golden.id, runId, score, passed, failureSummary }),
    }).catch(() => {});
  }

  const completeRes = await fetch(`${opts.baseUrl}/proof-runs/${proofRunId}/complete`, {
    method: 'POST',
    headers: { 'x-api-key': opts.apiKey },
  });

  if (!completeRes.ok) throw new Error(`AgentsProof: failed to complete proof suite — ${completeRes.status}`);
  return await completeRes.json();
}
