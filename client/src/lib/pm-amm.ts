export {catalog, listedMarkets, connection, readClient, evidence, explorer, loadMarkets, loadBalances, units} from '@shared/pm-amm/client';
export type {CatalogEntry} from '@shared/pm-amm/client';
import run from '../../../docs/pm-amm-web/run.devnet.json';
export const settledRedemptions = run.transactions.filter(t=>t.label.startsWith('collect:')||t.label.startsWith('creator-winnings:'));
