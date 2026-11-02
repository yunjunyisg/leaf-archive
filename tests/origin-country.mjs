import test from 'node:test';import assert from 'node:assert/strict';import {withOriginCountry,validOriginLocation} from '../shared/geography.js';
const location={lat:-15.981112345678,lon:128.417812345678,countryCode:'AU',country:'澳大利亚',state:'Western Australia',county:'Wyndham-East Kimberley',city:'',district:'',locality:'Kingston Rest',label:'旧标签',precision:'locality',source:'geonames',sourceId:'8351675',sourceUrl:'https://www.geonames.org/8351675/',featureType:'Homestead'};
test('adding a country after entering precise coordinates preserves the point and explicit local metadata',()=>{
 const original={...location,countryCode:'',country:'',source:'manual'},next=withOriginCountry(original,'AU','澳大利亚');assert.equal(next.lat,original.lat);assert.equal(next.lon,original.lon);assert.equal(next.precision,'locality');assert.equal(next.county,original.county);assert.equal(original.countryCode,'');assert.equal(validOriginLocation(next).countryCode,'AU');
});
test('changing a known country preserves coordinate precision but removes conflicting old region associations',()=>{
 const next=withOriginCountry(location,'BR','巴西');assert.equal(next.lat,location.lat);assert.equal(next.lon,location.lon);assert.equal(next.precision,location.precision);assert.equal(next.countryCode,'BR');assert.equal(next.country,'巴西');assert.equal(next.source,'manual');for(const key of ['state','county','city','district','locality'])assert.equal(next[key],'');for(const key of ['sourceId','sourceUrl','featureType'])assert.equal(next[key],undefined);assert.equal(location.sourceId,'8351675');assert.equal(location.state,'Western Australia');
});
test('choosing the same country retains valid region and georeference provenance',()=>{
 const next=withOriginCountry(location,'AU','澳大利亚');assert.equal(next.locality,location.locality);assert.equal(next.sourceId,location.sourceId);assert.equal(next.sourceUrl,location.sourceUrl);assert.equal(next.featureType,location.featureType);assert.equal(next.precision,location.precision);
});
test('clearing a country keeps valid zero coordinates and does not imply a more precise location',()=>{
 const next=withOriginCountry({...location,lat:0,lon:0,precision:'country'},'','');assert.equal(next.lat,0);assert.equal(next.lon,0);assert.equal(next.precision,'country');assert.equal(validOriginLocation(next).countryCode,'');
});
