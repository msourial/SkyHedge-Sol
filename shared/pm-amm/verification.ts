import type {MarketSpec} from './spec';
import type {Evidence} from './noaa';
import {sourceLabel, sourceQueryUrl, verifyLinkLabel, trustParagraph, missingDataNote} from './copy';

/** Published resolver evidence only. No substitute observations or inferred daily totals. */
export function verificationViewModel(spec:MarketSpec,record?:Evidence) {
  if(record && (record.spec.station!==spec.station || record.spec.start!==spec.start || record.spec.end!==spec.end || record.spec.thresholdTenths!==spec.thresholdTenths || record.spec.source!==spec.source)) throw Error('Evidence does not match market');
  return {
    source:sourceLabel(spec),station:spec.stationName,stationId:spec.station,
    stationIdLabel:spec.source==='eccc'?'Climate ID':'Station ID',
    window:`${spec.start} – ${spec.end}`,
    days:record?.evaluation.perDay.map(day=>({date:day.date,mm:day.tenths/10}))??[],
    totalMm:record?record.evaluation.totalTenths/10:null,
    thresholdMm:spec.thresholdTenths/10,
    outcome:record?.evaluation.outcome??null,
    sha256:record?.sha256??null,
    resolutionUrl:record?.resolveTx?`https://explorer.solana.com/tx/${record.resolveTx}?cluster=devnet`:null,
    sourceUrl:sourceQueryUrl(spec),verifyLabel:verifyLinkLabel(spec),trust:trustParagraph(spec),missingData:missingDataNote(spec),
  };
}
