# Invoice assistant tool completion exercise

This branch reproduces a Vercel AI SDK conversation-continuation bug using synthetic tool states. No payment or API request is made. The case checks whether the assistant waits when a dynamically registered tool still has work pending. The fixtures and included license identify their upstream source.

Run the native acceptance suite with Node 22.22 or newer, `npm ci --ignore-scripts` and `npm test`. The three Git revisions preserve the baseline, a partial fix with an edited assertion, and the upstream repair.
