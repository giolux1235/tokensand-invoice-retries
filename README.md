# Invoice retries

Replay a payment webhook against a synthetic SQLite ledger. Delivering the same $15.99 payment twice used to book $31.98. The corrected code records it once, rejects a changed amount on retry, and lets separate tenants use the same event ID.

From a Python 3.10+ environment, install the public Tokens& checker once.

```sh
python3 -m pip install https://raw.githubusercontent.com/giolux1235/tokensand-agent-pack/0a6d1c9254d9b41a7888e1df29a358fc656952b5/packages/tokensand_workflow_check-0.1.5-py3-none-any.whl
```

Reproduce the defect, then run the repaired implementation.

```sh
SHOW_BUG=1 python3 -m tokensand_check --offline-workflow ./workflow.py
python3 -m tokensand_check --offline-workflow ./workflow.py
```

The broken version fails `duplicate-delivery` and `changed-amount-on-retry`. The repair passes all four cases. Both runs use identical cases and run locally with synthetic records. [Tokens& setup](https://tokensand.com/agents/install)

This is a first-party Tokens& workshop example using invented transactions. It runs without provider keys. Local checks stay on your machine.
The ledger is reset for each test case. The example exercises sequential redelivery within a batch.
