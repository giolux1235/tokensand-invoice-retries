"""Run a webhook batch and check ledger totals against independent examples."""
import os
from ledger import reconcile


def invoice(tenant, event, cents=1599):
    return [tenant, event, cents, "USD"]


def sample(case, events, accounts, rejected=0):
    return {"id": case, "input": {"events": events, "accounts": accounts, "rejected": rejected}}


def evaluate(item, actual, variant):
    return {"ledger": lambda: actual["accounts"] == item["accounts"],
            "conflict": lambda: actual["rejected"] == item["rejected"]}


def broken(item):
    return reconcile(item["events"], protect_retries=False)


def fixed(item):
    return reconcile(item["events"], protect_retries=True)


workflow = {
    "cases": [
        sample("duplicate-delivery", [invoice("north", "p1")] * 2, [["north", "USD", 1, 1599]]),
        sample("changed-amount-on-retry", [invoice("north", "p1"), invoice("north", "p1", 1600)],
               [["north", "USD", 1, 1599]], rejected=1),
        sample("same-event-id-two-tenants", [invoice("north", "p1"), invoice("south", "p1")],
               [["north", "USD", 1, 1599], ["south", "USD", 1, 1599]]),
        sample("two-distinct-payments", [invoice("north", "p1"), invoice("north", "p2", 401)],
               [["north", "USD", 2, 2000]]),
    ],
    "checks": [{"id": "ledger", "label": "One correct balance per tenant and currency"},
               {"id": "conflict", "label": "Reject conflicting reuse of a payment event"}],
    "baseline": broken, "candidate": broken if os.environ.get("SHOW_BUG") == "1" else fixed,
    "evaluate": evaluate,
}
