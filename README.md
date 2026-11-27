# Invoice assistant tool completion exercise

This branch reproduces a Vercel AI SDK conversation-continuation bug using synthetic tool states. No payment or API request is made. The case checks whether the assistant waits when a dynamically registered tool still has work pending. The fixtures and included license identify their upstream source.

Run the native acceptance suite with Node 22.22 or newer, `npm ci --ignore-scripts` and `npm test`. The three Git revisions preserve the baseline, a partial fix with an edited assertion, and the upstream repair.

## Review the release

Open **Actions → Agent tool completion**. The mixed job should hold the partial repair. The repaired-only job should pass. Each summary identifies the exact revision and gives the submitted and original scores. Both jobs run the published Tokens& reviewer against the locked dependencies on a standard GitHub runner.

The proposed partial repair in this exercise changes one expectation. After the user asks a question, the assistant could send its next turn while a dynamic tool is still working. The upstream repair waits until the pending tool has finished. [Upstream change](https://github.com/vercel/ai/pull/7744)
