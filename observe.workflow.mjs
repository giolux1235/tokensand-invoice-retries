import { createInvoice } from "./subscription-invoice.mjs";

// A missing reference means category agreement cannot be assessed.
const expected = {
  "monthly-seat": { amount: 2400, category: "standard" },
  "prorated-seat": { amount: 600, category: "reduced" },
  "credit-memo": { amount: -450, category: "exempt" },
};

export default {
  id: "subscription-invoice", title: "Subscription invoice reconciliation", scope: "synthetic",
  repetitions: 3, timeoutMs: 2000, maxCallsPerRun: { baseline: 0, candidate: 0 },
  cases: Object.keys(expected).map(id => ({ id, input: id })),
  checks: [
    { id: "amount_matches", label: "Invoice amount" },
    { id: "category_matches", label: "Invoice category" },
  ],
  candidate: createInvoice,
  evaluate({ input, output }) {
    const reference = expected[input];
    return {
      amount_matches: output.amount === reference.amount,
      category_matches: reference.category === null ? null : output.category === reference.category,
    };
  },
};
