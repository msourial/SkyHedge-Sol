import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {PublicKey} from '@solana/web3.js';
import type {PendingStore} from '../src/pm-amm/transactions.ts';

/** Public metadata only, keyed by wallet identity rather than key-file location. */
export function createFilePendingStore(directory:string):PendingStore {
  const owned=new Set<string>();
  const path=(owner:string)=>join(directory,`${new PublicKey(owner).toBase58()}.json`);
  return {
    async get(owner) {
      try {return JSON.parse(await readFile(path(owner),'utf8'));}
      catch(error) {if ((error as NodeJS.ErrnoException).code==='ENOENT') return null;throw error;}
    },
    async set(owner,value) {
      await mkdir(directory,{recursive:true,mode:0o700});
      await writeFile(path(owner),JSON.stringify(value),{mode:0o600,flag:owned.has(owner)?'w':'wx'});
      owned.add(owner);
    },
    async remove(owner) {
      if (!owned.has(owner)) throw Error('Pending marker belongs to another process');
      await unlink(path(owner));owned.delete(owner);
    },
  };
}
