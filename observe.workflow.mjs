import { caseIds, search } from "./fixtures/search-deadline.mjs";

export default {
  id: "synthetic-search-deadline",
  repetitions: 3,
  timeoutMs: 2000,
  maxCallsPerRun: { candidate: 0 },
  cases: caseIds.map(id => ({ id, input: { id } })),
  checks: [{ id: "exact_document", label: "Returns the expected document" }],
  candidate: ({ id }, ctx) => search(id, ctx.repetition + 1, "broken"),
  evaluate: ({ output }) => ({
    exact_document: Array.isArray(output.ids) && output.ids.length === 1 && output.ids[0] === "doc-17",
  }),
};
