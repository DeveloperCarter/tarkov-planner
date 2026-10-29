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
// The Lab's layers from tarkov.dev: Second Level only over the north-west block, Technical below -0.9 m.
const floors=[
 {id:'1st',height:[-0.9,3],base:true},
 {id:'2nd',height:[3,10000],extents:[{height:[3,10000],bounds:[[[-101,-422],[-271,-270]]]}]},
 {id:'technical',height:[-10000,-0.9],extents:[{height:[-10000,-0.9]}]},
];
// Extract positions from the cached snapshot (gx, gz, gy).
const extracts=[
 {name:'Hangar Gate',gx:-170.5,gz:-218.9,gy:5.5},
 {name:'Parking Gate',gx:-231.5,gz:-457.8,gy:6.2},
 {name:'Cargo Elevator',gx:-111.8,gz:-408.6,gy:5.4},
 {name:'Transit to Streets of Tarkov',gx:-170.1,gz:-420.6,gy:1.2},
 {name:'Main Elevator',gx:-282.7,gz:-334.7,gy:-2.8},
 {name:'Sewage Conduit',gx:-122.9,gz:-258.3,gy:-3.7},
 {name:'Old data',x:1,y:2},
];
const on=id=>F.extractsOn(extracts,floors.find(f=>f.id===id),floors).map(e=>e.name);
test('extracts sit on the floor tarkov.dev assigns, honouring a layer\'s bounds',()=>{
 assert.deepEqual(on('1st'),['Hangar Gate','Parking Gate','Transit to Streets of Tarkov','Old data'],'high but outside the Second Level box');
 assert.deepEqual(on('2nd'),['Cargo Elevator','Old data']);
 assert.deepEqual(on('technical'),['Main Elevator','Sewage Conduit','Old data']);
});
test('floorOf falls back to the base floor and needs a height',()=>{
 assert.equal(F.floorOf({gx:0,gz:0,gy:1},floors).id,'1st');
 assert.equal(F.floorOf({gx:-150,gz:-300,gy:3},floors).id,'2nd','ranges include their low end');
 assert.equal(F.floorOf({gx:0,gz:0},floors),null);
 assert.equal(F.floorOf({gx:0,gz:0,gy:1},[]),null);
 assert.equal(F.floorOf({gx:0,gz:0,gy:1},[{id:'a',extents:[{height:[5,9]}]},{id:'b'}]).id,'b','without a base flag, the floor without extents');
 assert.equal(F.extractsOn(extracts,null,floors).length,extracts.length,'no floor chosen: every extract');
});
