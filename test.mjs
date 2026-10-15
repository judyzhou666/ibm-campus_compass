import assert from 'node:assert/strict';
import {EVENTS,DEFAULT_BLOCKS} from './frontend/src/data.ts';
import {parseRequest,issue,recommend,overlap} from './frontend/src/planner.ts';
const s={plan:[],blocks:DEFAULT_BLOCKS,interests:['AI & education','Career','Social'],buffer:15,cancelled:[]};
assert.equal(EVENTS.length,30);
assert.deepEqual(parseRequest('AI and education on Tuesday or Thursday afternoons').days,[1,3]);
assert.equal(parseRequest('after 1 PM').after,780);
assert.equal(parseRequest('before 11:30 am').before,690);
assert.equal(parseRequest('free food').food,'Free meal');
assert.deepEqual(parseRequest('start over',{food:'Free meal',days:[1],topics:['Career']}),{});
assert.match(issue(EVENTS.find(e=>e.id==='e4'),s),/Research Methods/);
assert.match(issue(EVENTS.find(e=>e.id==='e12'),s),/Membership/);
assert.match(issue(EVENTS.find(e=>e.id==='e15'),s),/Eligibility/);
assert.match(issue(EVENTS.find(e=>e.id==='e30'),s),/full/);
for(const q of ['AI on Tuesday or Thursday afternoons','social with free food','career after 1 PM','arts on Wednesday','weekend events','before 8 AM','no AI events']){
 const c=parseRequest(q),r=recommend(s,c);
 for(const e of r){assert.equal(issue(e,s),null);assert.ok(!c.days||c.days.includes(e.day));assert.ok(!c.food||c.food===e.food);assert.ok(c.after==null||e.start>=c.after);assert.ok(c.before==null||e.end<=c.before);assert.ok(!c.excluded?.includes(e.topic));}
 for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)assert.ok(!overlap(r[i],r[j],15));
}
assert.equal(recommend(s,parseRequest('weekend events')).length,0);
const first=recommend(s)[0];assert.ok(!recommend({...s,cancelled:[first.id]}).some(e=>e.id===first.id));
assert.ok(!recommend({...s,plan:[first.id]}).some(e=>e.id===first.id));
assert.ok(overlap({day:0,start:600,end:660},{day:0,start:670,end:720},15));
assert.ok(!overlap({day:0,start:600,end:660},{day:0,start:675,end:720},15));
console.log('PASS: dataset, parsing, filters, access, cancellations, schedule conflicts, pairwise travel buffers, and reset.');
