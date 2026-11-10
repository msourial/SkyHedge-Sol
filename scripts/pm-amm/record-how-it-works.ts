import {mkdirSync, writeFileSync, renameSync, readdirSync} from 'node:fs';
import {chromium} from 'playwright';

const out = '/tmp/pm-amm-how-it-works';
mkdirSync(out, {recursive: true});
const baseURL = process.env.HOW_IT_WORKS_BASE ?? 'http://127.0.0.1:5002';

const browser = await chromium.launch({headless: true});
const context = await browser.newContext({
  viewport: {width: 390, height: 844},
  deviceScaleFactor: 1,
  recordVideo: {dir: out, size: {width: 390, height: 844}},
  colorScheme: 'dark',
});
const page = await context.newPage();
let wallet = '';
page.on('request', (req) => {
  if (!req.url().includes('/api/faucet') || req.method() !== 'POST') return;
  const body = req.postDataJSON() as {wallet?: string} | null;
  if (body?.wallet) wallet = body.wallet;
});
const marks: {t: number; label: string}[] = [];
const started = Date.now();
const mark = (label: string) => {
  const t = Number(((Date.now() - started) / 1000).toFixed(3));
  marks.push({t, label});
  console.log(`mark ${t}s ${label}`);
};
const pause = (ms: number) => page.waitForTimeout(ms);

await page.goto(`${baseURL}/app`, {waitUntil: 'domcontentloaded', timeout: 30000});
mark('start');
await page.getByRole('region', {name: 'Wallet options'}).getByText(/\d[\d,]* mUSDC/).waitFor({timeout: 60000});
mark('funded');
await pause(3500);

const select = page.getByRole('button', {name: 'Select Toronto 10 mm 2026-12-14 market', exact: true});
await select.scrollIntoViewIfNeeded();
await pause(900);
mark('pick-market');
await select.click();
await page.getByText('MAKE YOUR CALL', {exact: true}).scrollIntoViewIfNeeded();
await pause(800);
await page.getByLabel('Amount · mUSDC').fill('5');
await pause(500);
await page.getByRole('button', {name: 'Review trade', exact: true}).click({timeout: 30000});
await page.getByRole('heading', {name: 'Review your trade'}).waitFor({timeout: 15000});
mark('review');
await pause(1800);
await page.getByRole('button', {name: 'Confirm trade', exact: true}).click();
await page.getByText('Trade confirmed on devnet.').waitFor({timeout: 60000});
mark('confirmed');
await page.getByRole('link', {name: 'View transaction ↗'}).scrollIntoViewIfNeeded();
await pause(2200);

const toronto = page.getByRole('article').filter({hasText: 'TORONTO INTL A'}).filter({hasText: '10 mm'}).first();
await toronto.scrollIntoViewIfNeeded();
await pause(600);
await toronto.getByText('How to verify', {exact: true}).click();
await page.getByRole('link', {name: 'Re-check Environment Canada observations ↗'}).first().scrollIntoViewIfNeeded();
mark('verify-eccc');
await pause(3800);

const demo = page.getByRole('article').filter({hasText: 'KNOWN-OUTCOME MECHANICS DEMO'});
await demo.scrollIntoViewIfNeeded();
await pause(700);
await demo.getByText('How to verify', {exact: true}).click();
await demo.getByRole('link', {name: 'Re-check NOAA observations ↗'}).scrollIntoViewIfNeeded();
mark('verify-example');
await pause(5000);
mark('end');

if (!wallet) {
  const shown = await page.locator('.pm-balance small').textContent();
  if (shown) wallet = shown.trim();
}
if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) throw Error('Recording wallet public key unavailable');

writeFileSync(`${out}/meta.json`, JSON.stringify({wallet, marks, recordedAt: new Date().toISOString()}, null, 2));
await context.close();
await browser.close();
const videos = readdirSync(out).filter((name) => name.endsWith('.webm'));
if (videos.length !== 1) throw Error(`Expected one raw recording, found ${videos.join(',')}`);
renameSync(`${out}/${videos[0]}`, `${out}/raw.webm`);
console.log('recorded', wallet, `${out}/raw.webm`);
