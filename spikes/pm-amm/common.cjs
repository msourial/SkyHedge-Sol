const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { AnchorProvider, Wallet } = require('@anchor-lang/core');
const { PmAmmClient } = require('@pm-amm/sdk');
const RPC = 'https://api.devnet.solana.com';
const PROGRAM = new PublicKey('GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y');
const MINT = new PublicKey('3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ');
const connection = new Connection(RPC, {commitment:'confirmed', disableRetryOnRateLimit:true});
const runPath = path.join(__dirname,'runs','devnet.json');
function save(run) {
  const temporary=runPath+'.tmp';
  fs.writeFileSync(temporary, JSON.stringify(run,null,2)+'\n');
  fs.renameSync(temporary,runPath);
}
function load() { return JSON.parse(fs.readFileSync(runPath,'utf8')); }
function wallet(role) {
  const dir = path.join(os.homedir(),'.config','skyhedge-pmamm');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const file = path.join(dir,role+'.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file,JSON.stringify(Array.from(Keypair.generate().secretKey)),{mode:0o600,flag:'wx'});
  fs.chmodSync(file,0o600);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file,'utf8'))));
}
function client(kp) {return PmAmmClient.fromProvider(new AnchorProvider(connection,new Wallet(kp),{commitment:'confirmed'}),PROGRAM,MINT);}
async function record(run,label,signature,extra={}) {
  run.transactions.push({label,signature,explorer:`https://explorer.solana.com/tx/${signature}?cluster=devnet`,...extra}); save(run); console.log(label,signature);
}
function readClient() {return PmAmmClient.readOnly(connection,PROGRAM,MINT);}
module.exports={readClient,fs,connection,PROGRAM,MINT,runPath,save,load,wallet,client,record,PublicKey};
