const test=require('node:test'),assert=require('node:assert/strict');
const F=require('../page/map-floors.js');
// Heights from tarkov.dev's Lab map: ground floor -0.9..3, Second Level 3.., Technical ..-0.9.
const ground={id:'1st',height:[-0.9,3]},second={id:'2nd',height:[3,10000]},technical={id:'technical',height:[-10000,-0.9]};
const labels=[
 {text:'Parking',bottom:-0.8,top:2},
 {text:'Boiler Room',bottom:-1000,top:2},
 {text:'Cafeteria',bottom:3,top:1000},
 {text:'Gate'},
];
const names=floor=>F.labelsOn(labels,floor).map(l=>l.text);
test('each Lab floor shows the labels whose height range overlaps it',()=>{
 assert.deepEqual(names(ground),['Parking','Boiler Room','Gate']);
 assert.deepEqual(names(second),['Cafeteria','Gate'],'touching the 3 m boundary is not overlapping');
 assert.deepEqual(names(technical),['Boiler Room','Gate'],'a label spanning two floors shows on both');
});
test('without a floor or heights every label shows',()=>{
 assert.deepEqual(names(null),['Parking','Boiler Room','Cafeteria','Gate']);
 assert.deepEqual(names({id:'x'}),['Parking','Boiler Room','Cafeteria','Gate']);
 assert.equal(F.onFloor({text:'Up',bottom:5},ground),false,'one-sided ranges are open on the other side');
 assert.equal(F.onFloor({text:'Down',top:0},ground),true);
 assert.deepEqual(F.labelsOn(undefined,ground),[]);
});
