// Synthetic monthly bill excerpts. Amounts are integer minor currency units.
const entries = {
  "monthly-seat": { unit: 1200, seats: 2, credit: 0, category: "standard" },
  "prorated-seat": { unit: 900, seats: 1, credit: 300, category: "reduced" },
  "credit-memo": { unit: 0, seats: 0, credit: 450, category: "exempt" },
};

export function createInvoice(id) {
  const entry = entries[id];
  if (!entry) throw new Error("Unknown invoice");
  return { amount: entry.unit * entry.seats - entry.credit, category: entry.category };
}
