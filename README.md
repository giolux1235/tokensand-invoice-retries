# Invoice retries

Replay a payment webhook against a synthetic SQLite ledger. Delivering the same $15.99 payment twice used to book $31.98. The corrected code records it once, rejects a changed amount on retry, and lets separate tenants use the same event ID.

With Python 3.10 or later, run the four Tokens& checks from a fresh checkout. The checker is included and runs offline. The same checks run on pull requests and pushes to main.

```sh
python3 -m unittest -v
```

To reproduce the original duplicate charge, run the same tests against the broken implementation.

```sh
SHOW_BUG=1 python3 -m unittest -v
```

The broken version fails `duplicate-delivery` and `changed-amount-on-retry`. The repair passes all four cases. Both runs use identical cases and run locally with synthetic records. [Tokens& setup](https://tokensand.com/agents/install)

This is a first-party Tokens& workshop example using invented transactions. It runs without provider keys. Local checks stay on your machine.
The ledger is reset for each test case. The example exercises sequential redelivery within a batch.
