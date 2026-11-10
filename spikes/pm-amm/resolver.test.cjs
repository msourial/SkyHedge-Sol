const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('./resolver.cjs');
const row={STATION:'USW00094728',DATE:'2026-10-01',PRCP:'0.0',PRCP_ATTRIBUTES:',,1,2400'};
test('known dry day and inclusive strike',()=>{assert.equal(evaluate([row]).outcome,'no');assert.equal(evaluate([{...row,PRCP:'1.0'}]).outcome,'yes');});
test('reject missing, duplicate, bad station/date/value and quality flags',()=>{
 for(const rows of [[],[row,row],[{...row,STATION:'wrong'}],[{...row,DATE:'2026-10-02'}],[{...row,PRCP:''}],[{...row,PRCP:'-9999'}],[{...row,PRCP:'NaN'}],[{...row,PRCP:'9'.repeat(400)}],[{...row,PRCP_ATTRIBUTES:',,1'}],[{...row,PRCP_ATTRIBUTES:',X,1,2400'}],[{...row,PRCP_ATTRIBUTES:undefined}]]) assert.throws(()=>evaluate(rows));
});
