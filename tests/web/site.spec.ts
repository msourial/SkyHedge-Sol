import {AccountLayout} from '@solana/spl-token';
import {test,expect,type Page} from '@playwright/test';
import {owner,rpcAccounts,fundMockWallet,activityTransaction,catalog} from './pm-fixture';
export async function mockChain(page:Page,opts?:{settled?:Record<string,number>}) {
  const accounts=await rpcAccounts(undefined,0,opts?.settled);
 await page.routeWebSocket('wss://api.devnet.solana.com/**',ws=>{ws.onMessage(data=>{const req=JSON.parse(String(data));ws.send(JSON.stringify({jsonrpc:'2.0',id:req.id,result:1}));if(req.method==='signatureSubscribe')ws.send(JSON.stringify({jsonrpc:'2.0',method:'signatureNotification',params:{subscription:1,result:{context:{slot:123},value:{err:null}}}}));});});
  await page.clock.install({time:new Date('2026-11-11T00:00:00Z')});
  await page.route('https://pm-amm-devnet.vercel.app/api/faucet',route=>route.fulfill({status:429,json:{error:'Faucet limit reached'}}));
  await page.route('https://api.devnet.solana.com/**',async route=> {
    const {id,method,params}=route.request().postDataJSON();
    let result:any;
    if(method==='getLatestBlockhash')result={context:{slot:123},value:{blockhash:'11111111111111111111111111111111',lastValidBlockHeight:1000}};
    else if(method==='sendTransaction')result='1'.repeat(64);
    else if(method==='getSignatureStatuses')result={context:{slot:123},value:[{slot:123,confirmations:1,err:null,confirmationStatus:'confirmed'}]};
    else if(method==='getMultipleAccounts')result={context:{slot:123},value:params[0].map((a:string)=>accounts[a]??null)};
    else if(method==='getAccountInfo')result={context:{slot:123},value:accounts[params[0]]??null};
    else if(method==='getSignaturesForAddress'){result=[{signature:catalog[params[0]].createdTx,slot:123,err:null,memo:null,blockTime:1794355200}];}
    else if(method==='getBalance')result={context:{slot:123},value:100000000};
    else if(method==='getTokenAccountBalance'&&!accounts[params[0]])return route.fulfill({json:{jsonrpc:'2.0',id,error:{code:-32602,message:'No token account'}}});
    else if(method==='getTokenAccountBalance'){const raw=AccountLayout.decode(Buffer.from(accounts[params[0]].data[0],'base64')).amount;result={context:{slot:123},value:{amount:raw.toString(),decimals:6,uiAmount:Number(raw)/1e6,uiAmountString:String(Number(raw)/1e6)}};}
    else return route.fulfill({json:{jsonrpc:'2.0',id,error:{code:-32000,message:'Mock RPC unavailable'}}});
    return route.fulfill({json:{jsonrpc:'2.0',id,result}});
  });
  return {accounts,change:async()=>Object.assign(accounts,await rpcAccounts(undefined,5))};
}
test('landing keeps app and native download links',async({page})=>{
 await page.goto('/');await expect(page.getByRole('link',{name:'Open app'})).toHaveAttribute('href','/app');await expect(page.getByRole('link',{name:'Download APK'})).toHaveAttribute('href','https://github.com/msourial/SkyHedge-Sol/releases');
});
test('app deep links, real catalog strikes, verification and mobile layout',async({page})=>{
 await mockChain(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/app');await expect(page.getByRole('heading',{name:'Trade the weather.'})).toBeVisible();
 await expect(page.getByText('50.00¢').first()).toBeVisible();
 for(const entry of Object.values(catalog).filter(e=>!e.hidden)){const s=entry.spec;await expect(page.getByRole('button',{name:`Select ${s.city} ${s.thresholdTenths/10} mm ${s.start} ${s.historicalDemo?'demo':'market'}`,exact:true})).toBeVisible();}
 for(const city of ['Seattle','Miami'])await expect(page.getByRole('button',{name:new RegExp('Select '+city)})).toHaveCount(0);
 await expect(page.getByText('CHICAGO OHARE INTL AP',{exact:true}).first()).toBeVisible();
 await page.getByText('How to verify',{exact:true}).click();await expect(page.getByRole('link',{name:'Re-check NOAA observations ↗'})).toHaveAttribute('href',/ncei.noaa.gov/);
 await expect(page.getByRole('link',{name:'Resolution transaction ↗'})).toHaveAttribute('href',/cluster=devnet/);
 await page.getByRole('link',{name:'Positions',exact:true}).click();await expect(page).toHaveURL(/\/app\/positions$/);await page.reload();await expect(page.getByRole('heading',{name:'Your weather positions'})).toBeVisible();
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(errors).toEqual([]);
});
test('unavailable chain does not invent a price or allow a quote',async({page})=>{
 await page.route('https://pm-amm-devnet.vercel.app/api/faucet',route=>route.fulfill({status:429,json:{error:'Faucet limit reached'}}));
  await page.route('https://api.devnet.solana.com/**',route=>route.fulfill({status:503,body:'Unavailable'}));await page.goto('/app/protect');
 await expect(page.getByRole('heading',{name:'Trade the weather.'})).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'503'}).first()).toBeVisible();await expect(page.getByRole('button',{name:'Review trade'})).toBeDisabled();
});

async function connectPhantom(page:Page) {
 await page.addInitScript(({address,bytes})=> {
  const handlers:Record<string,Function[]>={};const publicKey={toBase58:()=>address,toString:()=>address,toBytes:()=>new Uint8Array(bytes)};
  const provider={isPhantom:true,publicKey:null as any,isConnected:false,on:(event:string,cb:Function)=>{(handlers[event]??=[]).push(cb);},removeListener:()=>{},off:()=>{},connect:async()=>{provider.publicKey=publicKey;provider.isConnected=true;return {publicKey};},disconnect:async()=>{provider.publicKey=null;provider.isConnected=false;handlers.disconnect?.forEach(cb=>cb());},signTransaction:async()=>{(window as any).signRequests=((window as any).signRequests??0)+1;if((window as any).signMode==='success')return {serialize:()=>new Uint8Array(64)};if((window as any).signMode==='uncertain')throw Error('RPC confirmation unknown');throw Error('User rejected the request');},signAllTransactions:async()=>{throw Error('User rejected the request');}};
  (window as any).isPhantomInstalled=true;(window as any).disconnectTest=()=>provider.disconnect();(window as any).solana=provider;(window as any).phantom={solana:provider};
 },{address:owner.toBase58(),bytes:Array.from(owner.toBytes())});
}
test('Phantom review shows fee/minimum, rejection and token positions',async({page})=> {
 const chain=await mockChain(page);await connectPhantom(page);await page.goto('/app');await page.getByRole('button',{name:'Use Phantom',exact:true}).click();
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
 await page.getByRole('button',{name:/Phantom/}).last().click();
 await page.locator('.wallet-adapter-button-trigger').click();

 await expect(page.getByText('1,000 mUSDC available')).toBeVisible();
 await page.getByLabel('Amount · mUSDC').fill('10');await page.getByRole('button',{name:'Review trade',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review your trade'})).toBeVisible();await expect(page.getByText('0.2 mUSDC',{exact:true})).toBeVisible();await expect(page.getByText('Minimum received',{exact:true})).toBeVisible();
 await chain.change();await page.getByRole('button',{name:'Confirm trade',exact:true}).click();await expect(page.getByRole('status')).toContainText('The quote changed');
 await page.getByRole('button',{name:'Confirm trade',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'User rejected'})).toBeVisible();
 await page.getByRole('link',{name:'Positions',exact:true}).click();await expect(page.getByText('Yes shares').first()).toBeVisible();await expect(page.getByRole('button',{name:'Collect 5 mUSDC'})).toBeVisible();await page.getByRole('button',{name:'Collect 5 mUSDC'}).click();await expect(page.getByRole('alert').filter({hasText:'User rejected'})).toBeVisible();
 await page.getByRole('link',{name:'Markets',exact:true}).click();await page.getByRole('button',{name:'No',exact:true}).click();await page.getByRole('button',{name:'Review trade',exact:true}).click();await expect(page.getByText(/No shares$/)).toBeVisible();
});

test('uncertain action survives polling and reload until acknowledged',async({page})=> {
 await mockChain(page);await connectPhantom(page);await page.goto('/app');await page.getByRole('button',{name:'Use Phantom',exact:true}).click();await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:/Phantom/}).last().click();await page.locator('.wallet-adapter-button-trigger').click();await expect(page.getByText('1,000 mUSDC available')).toBeVisible();
 await page.evaluate(()=>{(window as any).signMode='uncertain';});await page.getByLabel('Amount · mUSDC').fill('5');await page.getByRole('button',{name:'Review trade',exact:true}).click();await page.getByRole('button',{name:'Confirm trade',exact:true}).click();
 await expect(page.getByText(/A previous wallet action needs checking/)).toBeVisible();await page.getByRole('button',{name:'Refresh markets'}).click();await expect(page.getByText(/A previous wallet action needs checking/)).toBeVisible();
 expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('skyhedge-pm-pending:')))).toBe(true);
 await page.evaluate(()=>{(window as any).isPhantomInstalled=true;(window as any).disconnectTest();});await expect(page.getByText('1,000 mUSDC available')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Review your trade'})).toHaveCount(0);
});
test('successful SDK buy and Collect show devnet receipts and refresh',async({page})=> {
 await mockChain(page);await connectPhantom(page);

 await page.goto('/app');await page.getByRole('button',{name:'Use Phantom',exact:true}).click();await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:/Phantom/}).last().click();await page.locator('.wallet-adapter-button-trigger').click();await expect(page.getByText('1,000 mUSDC available')).toBeVisible();await page.evaluate(()=>{(window as any).signMode='success';});
 await page.getByLabel('Amount · mUSDC').fill('5');await page.getByRole('button',{name:'Review trade',exact:true}).click();await page.getByRole('button',{name:'Confirm trade',exact:true}).click();await expect(page.getByRole('status')).toContainText('Trade confirmed');
 await expect(page.getByRole('link',{name:'View transaction ↗'})).toHaveAttribute('href',/cluster=devnet/);
 await page.getByRole('link',{name:'Positions',exact:true}).click();await page.getByRole('button',{name:'Collect 5 mUSDC'}).click();await expect(page.getByRole('status')).toContainText('Collected');
});

test('burner rate limit is readable, requested once, and wallet export/reset is explicit',async({page})=> {
 await mockChain(page);let requests=0;
 await page.route('https://pm-amm-devnet.vercel.app/api/faucet',route=>{requests++;return route.fulfill({status:429,headers:{'Retry-After':'3600'},json:{error:'Faucet limit reached'}});});
 await page.goto('/app');await expect(page.getByRole('alert').filter({hasText:'Faucet limit reached'})).toBeVisible();expect(requests).toBe(1);
 await page.getByRole('button',{name:'Refresh markets'}).click();expect(requests).toBe(1);
 await page.reload();await expect(page.getByRole('alert').filter({hasText:'already requested'})).toBeVisible();expect(requests).toBe(1);
 await expect(page.getByLabel('Secret devnet key', {exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'Export key',exact:true}).click();await expect(page.getByLabel('Secret devnet key', {exact:false})).toBeVisible();await page.getByRole('button',{name:'Hide key'}).click();
 await page.getByRole('button',{name:'New wallet',exact:true}).click();await expect(page.getByText(/Replacing this wallet removes/)).toBeVisible();await page.getByRole('button',{name:'Keep wallet'}).click();expect(requests).toBe(1);
 await page.getByRole('button',{name:'New wallet',exact:true}).click();await page.getByRole('button',{name:'Replace wallet',exact:true}).click();await expect.poll(()=>requests).toBe(2);
});

test('official burner faucet funds once and enables shared-code quote review',async({page})=> {
 const chain=await mockChain(page);let requests=0;
 await page.route('https://pm-amm-devnet.vercel.app/api/faucet',route=>{requests++;fundMockWallet(chain.accounts,route.request().postDataJSON().wallet);return route.fulfill({json:{ok:true,signature:'1'.repeat(64),amount:1000,sol:0.02}});});
 await page.goto('/app');await expect(page.getByText('1,000 mUSDC available')).toBeVisible();expect(requests).toBe(1);
 await page.getByLabel('Amount · mUSDC').fill('5');await page.getByRole('button',{name:'Review trade',exact:true}).click();await expect(page.getByRole('heading',{name:'Review your trade'})).toBeVisible();
});

test('storage denial leaves markets and Phantom readable without exposing a key',async({page})=> {
 await mockChain(page);await connectPhantom(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage denied');};Storage.prototype.setItem=()=>{throw Error('Storage denied');};});
 await page.goto('/app');await expect(page.getByRole('alert').filter({hasText:'Browser storage is unavailable'}).first()).toBeVisible();await page.getByRole('button',{name:'Use Phantom',exact:true}).click();
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:/Phantom/}).last().click();await page.locator('.wallet-adapter-button-trigger').click();await expect(page.getByText('1,000 mUSDC available')).toBeVisible();expect(errors).toEqual([]);
});
test('positive burner funds survive a refused top-up; signer switch clears review and positions',async({page})=> {
 const chain=await mockChain(page);await connectPhantom(page);
 await page.route('https://pm-amm-devnet.vercel.app/api/faucet',route=>{fundMockWallet(chain.accounts,route.request().postDataJSON().wallet,5000000n);return route.fulfill({status:429,json:{error:'Wait for faucet'}});});
 await page.goto('/app');await expect(page.getByText('5 mUSDC available')).toBeVisible();await expect(page.getByRole('alert').filter({hasText:'Wait for faucet'})).toBeVisible();
 await page.getByLabel('Amount · mUSDC').fill('1');await page.getByRole('button',{name:'Review trade',exact:true}).click();await expect(page.getByRole('heading',{name:'Review your trade'})).toBeVisible();await page.getByRole('button',{name:'Use Phantom',exact:true}).click();await expect(page.getByRole('heading',{name:'Review your trade'})).toHaveCount(0);await expect(page.getByText('5 mUSDC available')).toHaveCount(0);
});


test('public stats show real zero state from empty fixture history and source links',async({page})=>{
 await mockChain(page);await page.goto('/app');const stats=page.getByRole('region',{name:'Public market activity'});
 await expect(stats.getByText('No public swaps found after excluding SkyHedge wallets. All figures are zero.')).toBeVisible();
 await expect(stats.getByRole('row').filter({hasText:'All markets'}).getByRole('cell')).toHaveText(['0','0','0','0']);
 await expect(stats.getByRole('link').first()).toHaveAttribute('href',/explorer.solana.com\/address\/.*cluster=devnet/);
 const board=page.getByRole('region',{name:'Will It Rain? leaderboard'});
 await expect(board.getByText('The leaderboard stays empty until a Montreal or Toronto market settles.')).toBeVisible();
 await expect(board.getByRole('row')).toHaveCount(0);
 await page.setViewportSize({width:320,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('public stats sum observed fixture swaps and remain independent on errors',async({page})=>{
 await mockChain(page);
 let broken=false;
 await page.route('https://api.devnet.solana.com/**',async(route)=>{
  const {id,method,params}=route.request().postDataJSON();
  if(!['getSignaturesForAddress','getTransaction'].includes(method))return route.fallback();
  if(broken)return route.fulfill({status:503,body:'Unavailable'});
  const result=method==='getTransaction'?activityTransaction(Object.keys(catalog)[0]):[...(params[0]===Object.keys(catalog)[0]?[{signature:'1'.repeat(64),slot:123,err:null,memo:null,blockTime:1794355200}]:[]),{signature:catalog[params[0]].createdTx,slot:122,err:null,memo:null,blockTime:1794355200}];
  return route.fulfill({json:{jsonrpc:'2.0',id,result}});
 });
 await page.goto('/app');const stats=page.getByRole('region',{name:'Public market activity'});
 await expect(stats.getByRole('row').filter({hasText:'All markets'}).getByRole('cell')).toHaveText(['1','1','5','0.1']);
 broken=true;await stats.getByRole('button',{name:'Refresh stats'}).click();await expect(stats.getByRole('alert')).toContainText('Stats unavailable');
 await expect(page.getByText('CHICAGO OHARE INTL AP',{exact:true}).first()).toBeVisible();
 broken=false;await stats.getByRole('button',{name:'Retry stats'}).click();await expect(stats.getByRole('row').filter({hasText:'All markets'}).getByRole('cell')).toHaveText(['1','1','5','0.1']);
});

test('slow history times out without blocking market cards',async({page})=>{
 await mockChain(page);
 await page.route('https://api.devnet.solana.com/**',route=>route.request().postDataJSON().method==='getSignaturesForAddress'?new Promise<void>(()=>{}):route.fallback());
 await page.goto('/app');const stats=page.getByRole('region',{name:'Public market activity'});
 await expect(stats.getByText('Reading on-chain trade history…')).toBeVisible();
 await page.clock.fastForward(20001);await expect(stats.getByRole('alert')).toContainText('took too long');
 await expect(page.getByText('CHICAGO OHARE INTL AP',{exact:true}).first()).toBeVisible();
});

test('mid-December New York and Chicago thresholds stay explicit in ticket, review and positions',async({page})=>{
 await mockChain(page);await connectPhantom(page);await page.goto('/app');await page.getByRole('button',{name:'Use Phantom',exact:true}).click();await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('button',{name:/Phantom/}).last().click();await page.locator('.wallet-adapter-button-trigger').click();
 await expect(page.getByText('1,000 mUSDC available')).toBeVisible();
 for(const {city,threshold,station} of [{city:'New York',threshold:25,station:'NY CITY CNTRL PARK'},{city:'Chicago',threshold:5,station:'CHICAGO OHARE INTL AP'}]){
  await page.getByRole('button',{name:`Select ${city} ${threshold} mm 2026-12-14 market`,exact:true}).click();
  await expect(page.getByTestId('ticket-strike')).toHaveText(`Rainfall ≥ ${threshold} mm · ${station}`);
  await page.getByLabel('Amount · mUSDC').fill('5');await page.getByRole('button',{name:'Review trade',exact:true}).click();
  await expect(page.getByRole('region',{name:'Review trade'})).toContainText(`Rainfall ≥ ${threshold} mm · ${station} · 2026-12-14 – 2026-12-16 inclusive`);
  await page.getByRole('button',{name:'Back',exact:true}).click();
 }
 await page.getByRole('link',{name:'Positions',exact:true}).click();
 await expect(page.getByRole('region',{name:'Positions'}).getByText('Rainfall ≥ 25 mm · NY CITY CNTRL PARK',{exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Positions'}).getByText('Rainfall ≥ 5 mm · CHICAGO OHARE INTL AP',{exact:true})).toBeVisible();
});

test('Will It Rain? leaderboard is public, empty until settlement, then scores first cheap calls',async({page})=>{
 const toronto=Object.entries(catalog).find(([,e])=>e.spec.city==='Toronto'&&e.spec.thresholdTenths===100)![0];
 await mockChain(page,{settled:{[toronto]:1}});
 await page.route('https://api.devnet.solana.com/**',async(route)=>{
  const {id,method,params}=route.request().postDataJSON();
  if(!['getSignaturesForAddress','getTransaction'].includes(method))return route.fallback();
  const result=method==='getTransaction'?activityTransaction(toronto,20000000n):[...(params[0]===toronto?[{signature:'1'.repeat(64),slot:123,err:null,memo:null,blockTime:1794355200}]:[]),{signature:catalog[params[0]].createdTx,slot:122,err:null,memo:null,blockTime:1794355200}];
  return route.fulfill({json:{jsonrpc:'2.0',id,result}});
 });
 await page.goto('/app');
 const board=page.getByRole('region',{name:'Will It Rain? leaderboard'});
 await expect(board.getByRole('heading',{name:'Will It Rain?'})).toBeVisible();
 const row=board.getByRole('row').filter({hasText:'1111…1111'});
 await expect(row.getByRole('rowheader')).toHaveText('1');
 await expect(row.getByRole('cell')).toHaveText(['1111…1111','15','1']);
 await expect(board.getByRole('link',{name:'1111…1111'})).toHaveAttribute('href','https://explorer.solana.com/address/11111111111111111111111111111111?cluster=devnet');
});
