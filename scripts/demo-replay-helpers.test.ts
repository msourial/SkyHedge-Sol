import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardRpc, LOCAL_RPC, parseNoaaTotal } from './demo-replay-helpers';
test('RPC guard accepts only exact loopback RPC', () => {
  assert.equal(guardRpc(LOCAL_RPC), LOCAL_RPC);
  for (const rpc of ['https://api.devnet.solana.com','https://api.mainnet-beta.solana.com','http://127.0.0.1:8899.evil.com','http://localhost:8899','http://127.0.0.1:8899/']) assert.throws(()=>guardRpc(rpc));
});
test('NOAA metric total preserves decimals and rejects incomplete or invalid evidence', () => {
  const row = {STATION:'USW00094728',DATE:'2025-10-01',PRCP:'6.2'};
  const raw = JSON.stringify([row,{...row,DATE:'2025-10-02',PRCP:'0.3'}]);
  assert.equal(parseNoaaTotal(raw,'2025-10-01','2025-10-02').totalX100,650);
  for (const rows of [[row], [row,row], [{...row,PRCP:''}], [{...row,PRCP:'-9999'}], [{...row,STATION:'OTHER'}], [{...row,PRCP_ATTRIBUTES:',X,,'}]]) assert.throws(()=>parseNoaaTotal(JSON.stringify(rows),'2025-10-01','2025-10-02'));
});
