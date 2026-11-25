"""Book a synthetic payment webhook, scoped to a tenant."""
import sqlite3


def reconcile(events, *, protect_retries):
    db = sqlite3.connect(":memory:")
    with db:
        db.execute("CREATE TABLE receipts (tenant TEXT, event TEXT, cents INTEGER, currency TEXT)")
        rejected = 0
        for tenant, event, cents, currency in events:
            if protect_retries:
                old = db.execute(
                    "SELECT cents, currency FROM receipts WHERE tenant=? AND event=?",
                    (tenant, event),
                ).fetchone()
                if old is not None:
                    if old != (cents, currency):
                        rejected += 1
                    continue
            db.execute("INSERT INTO receipts VALUES (?,?,?,?)", (tenant, event, cents, currency))
        accounts = db.execute(
            "SELECT tenant, currency, COUNT(*), SUM(cents) FROM receipts "
            "GROUP BY tenant, currency ORDER BY tenant, currency"
        ).fetchall()
    db.close()
    return {"accounts": [list(row) for row in accounts], "rejected": rejected}
