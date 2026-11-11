import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicHistoryError} from './history-error';

test('history errors stay readable and never dump raw RPC bodies',()=>{
  assert.equal(publicHistoryError(Error('429: {"jsonrpc":"2.0","error":{"code":-32005}}')),'Devnet is busy right now. Retry to read this data.');
  assert.equal(publicHistoryError(Error('Market history incomplete: creation receipt unavailable')),'Market history incomplete: creation receipt unavailable');
});
