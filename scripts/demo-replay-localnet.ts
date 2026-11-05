// Deliberately no dotenv, database, chain.ts, or existing keypair imports.
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { AnchorProvider, Program, Wallet, type Idl } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, MINT_SIZE, createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, createMintToInstruction } from '@solana/spl-token';
import { LOCAL_RPC, guardRpc, datePlus, parseNoaaTotal } from './demo-replay-helpers';
const { values } = parseArgs({ options: { rpc: {type:'string'}, 'threshold-mm': {type:'string', default:'6'}, 'probability-bps': {type:'string', default:'2000'}, 'start-date': {type:'string'}, 'end-date': {type:'string'} } });
const rpc = guardRpc(values.rpc ?? process.env.SOLANA_RPC_URL ?? LOCAL_RPC);
const threshold = Number(values['threshold-mm']);
const probability = Number(values['probability-bps']);
if (!Number.isFinite(threshold) || threshold <= 0 || !Number.isSafeInteger(Math.round(threshold * 100)) || !Number.isInteger(probability) || probability < 100 || probability > 9000) throw new Error('Invalid threshold or probability (100..9000 bps)');
if (!!values['start-date'] !== !!values['end-date']) throw new Error('Supply both --start-date and --end-date');
const hash = (s: string) => [...createHash('sha256').update(s).digest()];
const bn = (n: number) => new BN(n);
const UNIT = 1_000_000;
const programId = new PublicKey('5hGLEG1ts46iER4pfWnP1fMb8sG5nxSinNY1pjYnNPWx');
const pda = (...seeds: Buffer[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
async function noaa(start: string, end: string) {
  const url = new URL('https://www.ncei.noaa.gov/access/services/data/v1');
  url.search = new URLSearchParams({dataset:'daily-summaries', stations:'USW00094728', dataTypes:'PRCP', startDate:start, endDate:end, units:'metric', format:'json', includeAttributes:'true'}).toString();
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`NOAA HTTP ${response.status}`);
  const raw = await response.text();
  return {start, end, raw, url: url.href, ...parseNoaaTotal(raw, start, end)};
}
async function main() {
  console.log('\n' + '='.repeat(78) + '\nLOCAL REPLAY - local Solana validator, not Devnet\n' + '='.repeat(78));
  console.log('Past NOAA evidence is replayed into a compressed local window. SKYT-LOCAL is a throwaway test token. No database required.');
  let evidence;
  if (values['start-date'] && values['end-date']) evidence = await noaa(values['start-date'], values['end-date']);
  else {
    for (let offset = 7; offset <= 84; offset += 7) {
      const end = datePlus(new Date().toISOString().slice(0,10), -offset);
      const candidate = await noaa(datePlus(end, -6), end);
      if (candidate.totalX100 >= Math.round(threshold * 100)) { evidence = candidate; break; }
    }
  }
  if (!evidence || evidence.totalX100 < Math.round(threshold * 100)) throw new Error('No triggering NOAA range found; choose a wetter past range for Collect');
  console.log('NOAA GHCN-Daily USW00094728, inclusive dates', evidence.start, evidence.end, evidence.url);
  console.table(evidence.daily);
  console.log('REAL past rainfall total:', evidence.totalX100 / 100, 'mm; threshold:', threshold, 'mm; demo quote probability:', probability, 'bps (user supplied, not a calibrated quote)');
  const dir = mkdtempSync('/tmp/skyhedge-replay-');
  writeFileSync(`${dir}/noaa.json`, evidence.raw, {flag:'wx'});
  const fresh = (name: string) => { const key = Keypair.generate(); writeFileSync(`${dir}/${name}.json`, JSON.stringify([...key.secretKey]), {mode:0o600, flag:'wx'}); return key; };
  const admin = fresh('admin'), authority = fresh('settlement-authority'), lp = fresh('lp'), buyer = fresh('buyer'), mint = fresh('mint');
  console.log('Fresh throwaway keys and raw NOAA JSON:', dir);
  const connection = new Connection(rpc, 'confirmed');
  const program = new Program(JSON.parse(readFileSync(new URL('../shared/idl/skyhedge_protection.json', import.meta.url), 'utf8')) as Idl, new AnchorProvider(connection, new Wallet(admin), {commitment:'confirmed'}));
  if (!program.programId.equals(programId)) throw new Error('Unexpected IDL program id');
  const protocol = pda(Buffer.from('protocol'));
  if (await connection.getAccountInfo(protocol)) throw new Error('Protocol already initialized: use a fresh /tmp validator ledger');
  const market = pda(Buffer.from('market'), protocol.toBuffer(), Buffer.alloc(8));
  const vault = pda(Buffer.from('vault'), market.toBuffer());
  const position = pda(Buffer.from('position'), market.toBuffer(), buyer.publicKey.toBuffer());
  const lpAta = getAssociatedTokenAddressSync(mint.publicKey, lp.publicKey), buyerAta = getAssociatedTokenAddressSync(mint.publicKey, buyer.publicKey);
  const balance = async (address: PublicKey) => { const account = await connection.getAccountInfo(address); return account ? (await connection.getTokenAccountBalance(address)).value.uiAmountString : '0'; };
  const snapshot = async () => ({vault: await balance(vault), buyer: await balance(buyerAta)});
  const report = async (label: string, action: () => Promise<string>) => {
    const before = await snapshot(); const sig = await action(); const after = await snapshot();
    console.log(`\n${label}\ntx: ${sig}\nvault SKYT-LOCAL: ${before.vault} -> ${after.vault}; buyer SKYT-LOCAL: ${before.buyer} -> ${after.buyer}\nhttps://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`);
  };
  for (const [name, key] of [['admin',admin],['settlement authority',authority],['LP',lp],['buyer',buyer]] as const) await report(`Airdrop local SOL: ${name}`, async () => { const sig = await connection.requestAirdrop(key.publicKey, 5e9); const confirmation = await connection.confirmTransaction(sig, 'confirmed'); if (confirmation.value.err) throw new Error('Airdrop failed'); return sig; });
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);
  await report('Create 6-decimal mint SKYT-LOCAL and issue local test balances', () => sendAndConfirmTransaction(connection, new Transaction().add(
    SystemProgram.createAccount({fromPubkey:admin.publicKey,newAccountPubkey:mint.publicKey,lamports:mintRent,space:MINT_SIZE,programId:TOKEN_PROGRAM_ID})
    , createInitializeMintInstruction(mint.publicKey,6,admin.publicKey,null),
    createAssociatedTokenAccountInstruction(admin.publicKey,lpAta,lp.publicKey,mint.publicKey),
    createAssociatedTokenAccountInstruction(admin.publicKey,buyerAta,buyer.publicKey,mint.publicKey),
    createMintToInstruction(mint.publicKey,lpAta,admin.publicKey,2000*UNIT),
    createMintToInstruction(mint.publicKey,buyerAta,admin.publicKey,1000*UNIT)
  ), [admin,mint]));
  const common = {protocol, market, collateralMint:mint.publicKey, tokenProgram:TOKEN_PROGRAM_ID};
  await report('initialize_protocol (local settlement authority)', () => program.methods.initializeProtocol(authority.publicKey).accounts({admin:admin.publicKey,collateralMint:mint.publicKey,tokenProgram:TOKEN_PROGRAM_ID}).rpc());
  const clock = async () => { const info = await connection.getAccountInfo(new PublicKey('SysvarC1ock11111111111111111111111111111111')); if (!info) throw new Error('Missing clock'); return Number(info.data.readBigInt64LE(32)); };
  const close = await clock() + 45, end = close + 90;
  const stationIdHash = hash('USW00094728');
  const methodologyHash = hash('LOCAL REPLAY v1: past NOAA daily PRCP sum, metric mm; compressed local window');
  console.log('Local sales close:', new Date(close*1000).toISOString(), 'local observation end:', new Date(end*1000).toISOString());
  await report('create_market: New York Central Park rain >= threshold', () => program.methods.createMarket({cityHash:hash('new-york'), stationIdHash, methodologyHash, providerHash:hash('NOAA GHCN-Daily Access Services'), quoteInputsHash:hash(JSON.stringify({localReplay:true, threshold, probability})), operator:{greaterThanOrEqual:{}}, thresholdMmX100:bn(Math.round(threshold*100)),salesCloseAt:bn(close),observationStart:bn(close),observationEnd:bn(end),quoteProbabilityBps:probability,maxLiquidity:bn(10000*UNIT),maxExposure:bn(8000*UNIT),perWalletMax:bn(500*UNIT)}).accounts({admin:admin.publicKey, ...common}).rpc());
  await report('fund_pool: 2000 SKYT-LOCAL', () => program.methods.fundPool(bn(2000*UNIT)).accounts({...common,provider:lp.publicKey,providerTokenAccount:lpAta}).signers([lp]).rpc());
  await report('open_market', () => program.methods.openMarket().accounts({admin:admin.publicKey,protocol,market}).rpc());
  await report('buyer open_position: 100 SKYT-LOCAL protected', () => program.methods.openPosition(bn(100*UNIT)).accounts({...common,owner:buyer.publicKey,ownerTokenAccount:buyerAta}).signers([buyer]).rpc());
  const wait = async (target: number, label: string) => { let last = -1; for (;;) { const remaining = target - await clock(); if (remaining <= 0) return; if (last < 0 || last - remaining >= 15) { console.log(`${label}: ${remaining}s remaining on local validator clock`); last = remaining; } await new Promise(r=>setTimeout(r,1000)); } };
  await wait(close,'Waiting for sales close');
  await report('lock_market', () => program.methods.lockMarket().accounts({market}).rpc());
  await wait(end,'Waiting for observation window end');
  await report('begin_settlement', () => program.methods.beginSettlement().accounts({market}).rpc());
  const sourceHash = hash(evidence.raw);
  console.log('NOAA raw JSON SHA256:', Buffer.from(sourceHash).toString('hex'));
  await report('submit_weather_observation: REAL past NOAA total, replayed locally', () => program.methods.submitWeatherObservation({stationIdHash,methodologyHash,observationWindowStart:bn(close),observationWindowEnd:bn(end),observedAt:bn(end),cumulativeRainfallMmX100:bn(evidence.totalX100),sourceHash}).accounts({authority:authority.publicKey,protocol,market}).signers([authority]).rpc());
  await report('settle_market', () => program.methods.settleMarket().accounts({settler:admin.publicKey,protocol,market}).rpc());
  const accounts = program.account as unknown as {market: {fetch(address: PublicKey): Promise<{result: unknown; status: unknown}>}; protectionPosition: {fetch(address: PublicKey): Promise<{payoutClaimed: boolean}>}};
  const state = await accounts.market.fetch(market);
  console.log('MARKET RESULT:', JSON.stringify(state.result), 'status:', JSON.stringify(state.status));
  const beforeBuyer = await balance(buyerAta), beforeVault = await balance(vault);
  await report('Collect: buyer claim_payout', () => program.methods.claimPayout().accounts({...common,owner:buyer.publicKey,ownerTokenAccount:buyerAta,position}).signers([buyer]).rpc());
  const claimed = await accounts.protectionPosition.fetch(position);
  if (!claimed.payoutClaimed || Number(await balance(buyerAta))-Number(beforeBuyer) !== 100 || Number(beforeVault)-Number(await balance(vault)) !== 100) throw new Error('Claim verification failed');
  console.log('\nCOLLECT SUCCEEDED: payout_claimed=true; buyer +100 SKYT-LOCAL; vault -100 SKYT-LOCAL. LOCAL REPLAY ONLY.');
}
void main().catch(error => { console.error('LOCAL REPLAY FAILED:', error); process.exitCode=1; });
