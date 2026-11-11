import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Connection, Keypair, PublicKey} from '@solana/web3.js';
import {getAssociatedTokenAddressSync, unpackAccount} from '@solana/spl-token';
import {assertCatalogIdentity} from '../../shared/pm-amm/spec';
import {RPC, PROGRAM, MINT} from '../../shared/pm-amm/trading';
// SDK's Node ESM entry imports a named BN from CommonJS; use its CJS export.
const require = createRequire(import.meta.url);
const {PmAmmClient} = require('@pm-amm/sdk') as typeof import('@pm-amm/sdk');
const {AnchorProvider, Wallet} = require('@anchor-lang/core') as typeof import('@anchor-lang/core');
export const connection = new Connection(RPC, {commitment:'confirmed', disableRetryOnRateLimit:true});
export const catalogPath = 'shared/pm-amm/markets.devnet.json';
export const logPath = 'docs/pm-amm-web/run.devnet.json';
export function readJson(file: string): any {return JSON.parse(fs.readFileSync(file, 'utf8'));}
export function saveJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(file + '.tmp', file);
}
export function wallet(role = 'creator') {
  if (!['creator', 'no-trader', 'web-trader'].includes(role)) throw Error('Unknown operator wallet');
  const file = path.join(os.homedir(), '.config/skyhedge-pmamm', role + '.json');
  if ((fs.statSync(file).mode & 0o077) !== 0) throw Error('Wallet permissions must be 600');
  return Keypair.fromSecretKey(Uint8Array.from(readJson(file)));
}
export function client(kp?: Keypair) {
  const program = new PublicKey(PROGRAM), mint = new PublicKey(MINT);
  return kp ? PmAmmClient.fromProvider(new AnchorProvider(connection, new Wallet(kp), {commitment:'confirmed'}), program, mint) : PmAmmClient.readOnly(connection, program, mint);
}
export function log() {return fs.existsSync(logPath) ? readJson(logPath) : {rpc:RPC, program:PROGRAM, mint:MINT, attempts:{}, transactions:[]};}
/** Persist before every send; a failed/ambiguous send must be reconciled manually. */
export async function sendOnce(label: string, send: () => Promise<string>) {
  let run = log();
  const done = run.transactions.find((t: any) => t.label === label);
  if (done) return done.signature as string;
  if (run.attempts[label]) throw Error(`Manually reconcile prior attempt: ${label}`);
  run.attempts[label] = {at:new Date().toISOString()}; saveJson(logPath, run);
  const signature = await send();
  run = log(); run.transactions.push({label, signature, explorer:`https://explorer.solana.com/tx/${signature}?cluster=devnet`}); saveJson(logPath, run);
  console.log(label, signature);
  return signature;
}
export async function tokenBalances(mints: PublicKey[], owner: PublicKey): Promise<bigint[]> {
  const addresses = mints.map(m => getAssociatedTokenAddressSync(m, owner));
  const accounts = await connection.getMultipleAccountsInfo(addresses);
  return accounts.map((info, i) => info ? unpackAccount(addresses[i], info).amount : 0n);
}
export async function checkedMarket(address: string, kp = wallet()) {
  const entry = readJson(catalogPath)[address];
  if (!entry) throw Error('Market absent from catalog');
  const sdk = client(kp), market = new PublicKey(address), state = await sdk.fetchMarket(market);
  if (!state) throw Error('Missing market');
  assertCatalogIdentity(entry, state, MINT);
  if (!state.authority.equals(kp.publicKey)) throw Error('Creator wallet mismatch');
  return {entry, sdk, market, state};
}
export function marketArg() {
  const at = process.argv.indexOf('--market');
  if (at < 0 || !process.argv[at + 1]) throw Error('Usage: --market <pubkey> [--send]');
  return new PublicKey(process.argv[at + 1]).toBase58();
}
