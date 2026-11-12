"use strict";
// Contract tests only. Never opens AE or changes a project/preferences.
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),helper=fs.readFileSync(path.join(root,"Atalhos AE-assets/null-action.jsxinc"),"utf8");
const jsx=file=>fs.readFileSync(path.join(root,file),"utf8").replace(/^#target.*$/gm,"");
function setup(){
  const alerts=[],undo=[],list=[];
  class Comp {
    constructor(){this.width=1920;this.height=1080;this.duration=30;this.time=4;this.layers={addNull:duration=>{assert.equal(duration,this.duration);return layer(true);}};}
    get numLayers(){return list.length;}get selectedLayers(){return list.filter(l=>l.selected);}layer(index){return list[index-1];}
  }
  const comp=new Comp();
  function layer(isNull,threeD=false){
    const position={value:threeD?[20,30,40]:[20,30],setValue(v){this.value=Array.from(v);}},anchor={value:threeD?[10,15,20]:[10,15],valueAtTime(t,pre){assert.equal(t,comp.time);assert.equal(pre,false);return this.value.slice();}};
    const result={nullLayer:isNull,threeDLayer:threeD,name:'Renamed controller',selected:false,parent:null,position,anchor,rotation:30,scale:[80,90,100],containingComp:comp,
      get index(){return list.indexOf(this)+1;},property(key){assert.equal(key,'ADBE Transform Group');return{property(key){return key==='ADBE Position'?position:key==='ADBE Anchor Point'?anchor:assert.fail(key);}};},
      setParentWithJump(parent){this.parent=parent;},moveBefore(before){list.splice(list.indexOf(this),1);list.splice(list.indexOf(before),0,this);}};
    list.unshift(result);return result;
  }
  const context={CompItem:Comp,app:{project:{activeItem:comp},beginUndoGroup(n){undo.push(['begin',n]);},endUndoGroup(){undo.push(['end']);}},alert(...args){alerts.push(args);},$:{global:{},fileName:'/Scripts/ScriptUI Panels/Atalhos AE.jsx'}};
  vm.createContext(context);vm.runInContext(helper,context);
  return{context,comp,layer,list,alerts,undo,run:()=>context.$.global.__ATALHOS_AE_NULL_ACTION__.run()};
}
test('plain NULL creates one centered independent 2D null and a single Undo group',()=>{
  const f=setup(),n=f.run();assert.equal(f.list.length,1);assert.equal(n.nullLayer,true);assert.equal(n.threeDLayer,false);assert.equal(n.parent,null);assert.deepEqual(n.position.value,[960,540]);assert.equal(n.selected,true);assert.equal(f.undo.length,2);assert.deepEqual(f.alerts,[]);
});
test('selected renamed null becomes parent of new null, never the other way round',()=>{
  const f=setup(),old=f.layer(true);old.selected=true;const original=JSON.stringify({position:old.position.value,anchor:old.anchor.value,rotation:old.rotation,scale:old.scale});
  const n=f.run();assert.equal(n.parent,old);assert.equal(old.parent,null);assert.deepEqual(n.position.value,[10,15]);assert.equal(n.index+1,old.index);assert.equal(old.selected,false);assert.equal(n.selected,true);
  assert.equal(JSON.stringify({position:old.position.value,anchor:old.anchor.value,rotation:old.rotation,scale:old.scale}),original);
});
test('consecutive NULL presses create a chain from the newest selected null',()=>{
  const f=setup(),a=f.run(),b=f.run(),c=f.run();assert.equal(b.parent,a);assert.equal(c.parent,b);assert.equal(a.parent,null);assert.equal(f.list.length,3);assert.equal(f.comp.selectedLayers[0],c);
});
test('3D parent produces 3D child aligned at its custom anchor, without moving the parent',()=>{
  const f=setup(),old=f.layer(true,true);old.selected=true;const n=f.run();assert.equal(n.threeDLayer,true);assert.equal(n.parent,old);assert.deepEqual(n.position.value,[10,15,20]);assert.deepEqual(old.position.value,[20,30,40]);
});
test('ordinary layer named Null does not become parent; real topmost selected null wins',()=>{
  const f=setup(),ordinary=f.layer(false);ordinary.name='Null';ordinary.selected=true;assert.equal(f.run().parent,null);
  const bottom=f.layer(true),top=f.layer(true);bottom.selected=true;top.selected=true;ordinary.selected=true;assert.equal(f.run().parent,top);
});
test('no composition gives a helpful message and performs no mutation',()=>{
  const f=setup();f.context.app.project.activeItem=null;assert.equal(f.run(),null);assert.equal(f.list.length,0);assert.equal(f.undo.length,0);assert.equal(f.alerts.length,1);
});
test('failure after addNull always closes Undo, reports error, never reparents old layer',()=>{
  const f=setup(),old=f.layer(true);old.selected=true;const add=f.comp.layers.addNull;f.comp.layers.addNull=d=>{const n=add(d);n.setParentWithJump=()=>{throw Error('native error');};return n;};
  assert.equal(f.run(),null);assert.equal(f.undo.length,2);assert.equal(f.alerts.length,1);assert.equal(old.parent,null);
});
function installMockLoader(f,scriptName){
  f.context.$.fileName='/Scripts/'+scriptName;
  f.context.File=function(p){return{fsName:p,parent:{fsName:path.posix.dirname(p)},exists:p.endsWith('null-action.jsxinc')};};
  f.context.Folder=function(p){return{fsName:p};};
  f.context.$.evalFile=function(file){assert.match(file.fsName,/Atalhos AE-assets\/null-action\.jsxinc$/);vm.runInContext(helper,f.context);};
}
test('native Scripts-menu wrapper works with panel closed and calls the shared action once',()=>{
  const f=setup();installMockLoader(f,'zz Atalhos AE - NULL.jsx');vm.runInContext(jsx('zz Atalhos AE - NULL.jsx'),f.context);assert.equal(f.list.length,1);assert.equal(f.undo.length,2);
});
test('panel NULL button uses the same action; no fake global key listener or polling',()=>{
  const f=setup(),buttons=[];installMockLoader(f,'ScriptUI Panels/Atalhos AE.jsx');
  class Control{constructor(kind,label){this.size={width:600,height:50};this.layout={layout(){},resize(){}};this.kind=kind;this.label=label;}add(kind,bounds,label){const child=new Control(kind,label);if(kind==='button')buttons.push(child);return child;}center(){}show(){}}
  f.context.Panel=class Panel extends Control{};f.context.Window=class Window extends Control{};f.context.ScriptUI={};
  const source=jsx('Atalhos AE.jsx');vm.runInContext(source,f.context);const button=buttons.find(b=>b.label==='NULL');assert.ok(button);button.onClick();button.onClick();assert.equal(f.list.length,2);assert.equal(f.list[0].parent,f.list[1]);
  assert.ok(!/scheduleTask\(|setInterval\(|addEventListener\(\s*["']keydown/.test(source));
});
test('shared action remains compatible with ExtendScript ES3 syntax conventions',()=>{
  for(const source of [helper,jsx('zz Atalhos AE - NULL.jsx')]){assert.ok(!/\b(?:const|let|class|async)\s|=>|\.includes\(|\.forEach\(/.test(source));new vm.Script(source);}
});
