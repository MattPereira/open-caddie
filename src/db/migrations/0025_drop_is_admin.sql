-- Switch of #95: "isAdmin" left schema.ts, but expand's code still selects it,
-- so the column stays until the contract step drops it.
SELECT 1;
