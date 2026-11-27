# Invoice retries

Replay a payment webhook against a synthetic SQLite ledger. Delivering the same $15.99 payment twice used to book $31.98. The corrected code records it once, rejects a changed amount on retry, and lets separate tenants use the same event ID.

With Python 3.10 or later, clone the example and enter its directory. The Tokens& checker is included.

```sh
git clone https://github.com/giolux1235/tokensand-invoice-retries
cd tokensand-invoice-retries
```

Reproduce the duplicate charge. Expect `duplicate-delivery` and `changed-amount-on-retry` to fail.

```sh
SHOW_BUG=1 python3 -m unittest -v
```

Verify the repair. All four cases should pass.

```sh
python3 -m unittest -v
```

Both commands run the same cases offline. Pull requests and pushes to `main` run the same four checks.

This is a first-party Tokens& workshop example using invented transactions. It runs without provider keys.
The ledger is reset for each test case. The example exercises sequential redelivery within a batch.

[View Invoice Retry Ledger on Tokens&](https://tokensand.com/p/invoice-retry-ledger) to share this example or set up checks for your own project.
