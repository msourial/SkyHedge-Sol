import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
const profile=path.join(os.homedir(),'.config/skyhedge-pmamm/browser-profile');
fs.mkdirSync(profile,{recursive:true,mode:0o700});
const catalog=JSON.parse(fs.readFileSync('shared/pm-amm/markets.devnet.json','utf8'));
const market=Object.keys(catalog).find(a=>!catalog[a].spec.historicalDemo)!;
const direction='usdcToYes',inputRaw=5000000;
const shots='docs/pm-amm-web/shots';fs.mkdirSync(shots,{recursive:true});
const logFile='docs/pm-amm-web/browser.devnet.json';
const run: {startedAt:string;mode:string;funding:unknown[];transactions:unknown[];errors:string[];wallet?:string;review?:string;balance?:string;completedAt?:string}={startedAt:new Date().toISOString(),mode:'real devnet browser; no RPC mocks',funding:[],transactions:[],errors:[]};
if(fs.existsSync(logFile)){const prior=JSON.parse(fs.readFileSync(logFile,'utf8'));run.funding=prior.funding??[];run.transactions=(prior.transactions??[]).map((t:any)=>({...t,review:t.review??prior.review}));}
const context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:1440,height:1000},timezoneId:'America/Chicago'});
const page=await context.newPage();
page.on('pageerror',e=>run.errors.push(e.message));
page.on('response',async response=> {
  if(response.url()==='https://pm-amm-devnet.vercel.app/api/faucet') {
    try{const body=await response.json();run.funding.push({status:response.status(),...body});}catch{run.errors.push('Faucet response could not be read');}
  }
});
try {
  await page.goto('http://127.0.0.1:5002/app');
  await page.getByRole('heading',{name:'Trade the weather.'}).waitFor();
  await page.locator('.pm-balance small').waitFor({timeout:45000});
  await page.getByText('Setting up your devnet wallet…',{exact:true}).waitFor({state:'hidden',timeout:45000});
  await page.locator('.pm-balance span').filter({hasNotText:/^0 mUSDC/}).waitFor({timeout:45000});
  run.wallet=await page.locator('.pm-balance small').innerText();run.balance=await page.locator('.pm-balance span').innerText();
  await page.screenshot({path:`${shots}/markets.png`,fullPage:true});
  await page.getByRole('button',{name:`Select ${catalog[market].spec.city} market`,exact:true}).click();
  await page.getByLabel('Amount · mUSDC').fill('5');
  await page.getByRole('button',{name:'Review trade',exact:true}).click();
  await page.getByRole('heading',{name:'Review your trade'}).waitFor();
  run.review=await page.getByRole('region',{name:'Review trade',exact:true}).innerText();
  await page.screenshot({path:`${shots}/review.png`,fullPage:true});
  if(process.argv.includes('--trade')) {
    // One attempt only. A changed quote means no send occurred, so review once more.
    await page.getByRole('button',{name:'Confirm trade',exact:true}).click();
    const outcome=page.getByRole('status').filter({hasText:/Trade confirmed|The quote changed/});
    await outcome.waitFor({timeout:45000});
    if((await outcome.innerText()).includes('The quote changed')){
      run.review=await page.getByRole('region',{name:'Review trade',exact:true}).innerText();
      await page.screenshot({path:`${shots}/review.png`,fullPage:true});
      await page.getByRole('button',{name:'Confirm trade',exact:true}).click();
    }
    await page.getByRole('status').filter({hasText:'Trade confirmed'}).waitFor({timeout:45000});
    const href=await page.getByRole('link',{name:'View transaction ↗'}).getAttribute('href');
    run.transactions.push({action:'buy Yes with 5 mUSDC',explorer:href,market,direction,inputRaw,review:run.review});
  }
  await page.getByRole('link',{name:'Positions',exact:true}).click();
  await page.getByRole('heading',{name:'Your weather positions'}).waitFor();
  await page.screenshot({path:`${shots}/positions.png`,fullPage:true});
  await page.getByRole('link',{name:'Markets',exact:true}).click();
  await page.getByText('How to verify',{exact:true}).click();
  await page.getByRole('link',{name:'Re-check NOAA observations ↗'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`${shots}/settled-verification.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${shots}/markets-mobile.png`,fullPage:true});
  run.completedAt=new Date().toISOString();
} catch(e) {
  run.errors.push(e instanceof Error?e.message:String(e));
  await page.screenshot({path:`${shots}/browser-blocker.png`,fullPage:true});
  process.exitCode=1;
} finally {
  // Never read, export or log the browser's key. This profile stays outside git.
  await context.close();
  fs.writeFileSync(logFile,JSON.stringify(run,null,2)+'\n');
  const secure=(dir:string)=>{fs.chmodSync(dir,0o700);for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())secure(file);else if(entry.isFile())fs.chmodSync(file,0o600);}};
  secure(profile);
  console.log('Browser capture result',run.completedAt?'complete':'blocked',run.wallet??'wallet unavailable');
}
