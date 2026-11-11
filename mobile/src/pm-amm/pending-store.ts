import * as SecureStore from 'expo-secure-store';
import type {PendingStore} from './transactions.ts';
const key=(owner:string)=>`pmamm.pending.${owner}`;
export const securePendingStore:PendingStore={
  async get(owner) {const value=await SecureStore.getItemAsync(key(owner));return value?JSON.parse(value):null;},
  async set(owner,value) {await SecureStore.setItemAsync(key(owner),JSON.stringify(value));},
  async remove(owner) {await SecureStore.deleteItemAsync(key(owner));},
};
