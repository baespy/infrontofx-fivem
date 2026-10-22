# FiveM database work

Start with the installed skill database and FC references. Inspect the server's actual framework/inventory implementation before changing money or item persistence.

- Use oxmysql parameter placeholders for values. Identifiers such as table names must come from a fixed allowlist, not client input.
- Use query/single/scalar/insert/update according to the required return shape. Await is only valid in a yieldable context; it is a point at which identity and state may change.
- A transaction success boolean means SQL statements succeeded. It does not mean a conditional debit changed a row: zero affected rows is not a SQL error. Dependent grants must be conditional on a successful debit within an atomic design.
- Do not independently modify ESX-owned balances in SQL while ESX owns an in-memory copy. The next framework save can overwrite the change. Keep the operation within the installed persistence owner or design an explicit migration.
- Keep transactions short, bound batches and retry only operations designed to be idempotent. Never assume separate await queries share one transaction connection.
- Give retries a stable operation identity; back it with database constraints where necessary. A UI disabled button cannot prevent duplicate grants.
- Plan indexes from actual WHERE/ORDER BY predicates and EXPLAIN. Select only needed columns and paginate large collections.

Sources checked 2026-10-22:

- https://overextended.dev/docs/oxmysql/Functions/transaction
- https://github.com/esx-framework/esx_core
