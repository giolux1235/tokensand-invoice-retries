# Invoice assistant tool completion exercise

This branch reproduces a Vercel AI SDK conversation-continuation bug using synthetic tool states. No payment or API request is made. The case checks whether the assistant waits when a dynamically registered tool still has work pending. The fixtures and included license identify their upstream source.

Run the native acceptance suite with Node 22.22 or newer, `npm ci --ignore-scripts` and `npm test`. The three Git revisions preserve the baseline, a partial fix with an edited assertion, and the upstream repair.

## Review the release

Open **Actions → Agent tool completion**. The mixed job should hold the partial repair. The repaired-only job should pass. Each summary identifies the exact revision and gives the submitted and original scores. Both jobs run the published Tokens& reviewer against the locked dependencies on a standard GitHub runner.

The proposed partial repair in this exercise changes one expectation. After the user asks a question, the assistant could send its next turn while a dynamic tool is still working. The upstream repair waits until the pending tool has finished. [Upstream change](https://github.com/vercel/ai/pull/7744)

The two [shared review notes](.github/reviews) were created on macOS. In each job the Linux reviewer reruns the selected tests against the same Git revisions. Exit 100 means it reproduced a hold, exit 0 means it verified the repair, and exit 1 means the note or evidence could not be verified. The public notes contain aggregate results for synthetic data. [Reviewer commands](https://github.com/giolux1235/tokensand-agent-pack#review-an-existing-vitest-test)
