"use strict";
// Isolated fixtures only. No real Adobe application or user preferences touched.
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const root=path.resolve(__dirname,".."),installer=path.join(root,"install.ps1"),mac=path.join(root,"INSTALAR.command");
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const psQuote=s=>"'"+s.replace(/'/g,"''")+"'";
const hasPS=process.platform==='win32';
const powershell=process.platform==='win32'?'powershell.exe':'pwsh';
function ps(source){const r=cp.spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',source],{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
function fixture(t){
  const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'atalhos-ae-test-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,"Pacote Pós & 100%"),app=path.join(dir,'Adobe After Effects 2027'),prefs=path.join(dir,'preferences'),backup=path.join(dir,'backups');
  fs.mkdirSync(path.join(app,'Support Files'),{recursive:true});fs.writeFileSync(path.join(app,'Support Files','AfterFX.exe'),'fixture only');
  fs.mkdirSync(path.join(source,'Atalhos AE-assets'),{recursive:true});
  for(const file of ['Atalhos AE.jsx','zz Atalhos AE - NULL.jsx'])fs.copyFileSync(path.join(root,file),path.join(source,file));
  for(const file of fs.readdirSync(path.join(root,'Atalhos AE-assets')).filter(x=>/\.(png|jsxinc)$/.test(x)))fs.copyFileSync(path.join(root,'Atalhos AE-assets',file),path.join(source,'Atalhos AE-assets',file));
  return{dir,source,app,prefs,backup};
}
function planScript(f,extra=''){return "$ErrorActionPreference='Stop'; . "+psQuote(installer)+"; $plan=New-AtalhosAEPlan "+[f.source,f.app,f.prefs,'27.0'].map(psQuote).join(' ')+"; "+extra;}
test('Windows installer parses and does not alter global effects, keyboard prefs or kill Adobe', {skip:!hasPS},()=>{
  ps("$errors=$null; [Management.Automation.Language.Parser]::ParseFile("+psQuote(installer)+",[ref]$null,[ref]$errors) | Out-Null; if($errors.Count){throw ($errors|Out-String)}");
  const s=fs.readFileSync(installer,'utf8');assert.ok(!/PresetEffects\.xml|Stop-Process|taskkill|Keyboard Shortcuts.*Write|SendKeys/.test(s));assert.match(s,/Get-Process AfterFX/);assert.match(s,/InvocationName -ne '\.'/);
});
test('fresh install plans official Adobe Scripts paths without requiring preferences or pseudo XML',{skip:!hasPS},t=>{
  const f=fixture(t);const result=JSON.parse(ps(planScript(f,"$plan | ConvertTo-Json -Depth 4 -Compress")));
  assert.equal(result.Panels[0],path.join(f.app,'Support Files','Scripts','ScriptUI Panels'));
  assert.ok(result.Entries.some(e=>e.Target===path.join(f.app,'Support Files','Scripts','zz Atalhos AE - NULL.jsx')));
  assert.ok(result.Entries.every(e=>!e.Source.endsWith('.xml')));assert.equal(fs.existsSync(f.prefs),false);
});
test('existing per-user panel is upgraded in place instead of adding a second panel',{skip:!hasPS},t=>{
  const f=fixture(t),old=path.join(f.prefs,'27.0','Scripts','ScriptUI Panels');fs.mkdirSync(old,{recursive:true});fs.writeFileSync(path.join(old,'Atalhos AE.jsx'),'old');
  const result=JSON.parse(ps(planScript(f,"$plan | ConvertTo-Json -Depth 4 -Compress")));
  assert.deepEqual(result.Panels,[old]);assert.ok(!result.Entries.some(e=>e.Target===path.join(f.app,'Support Files','Scripts','ScriptUI Panels','Atalhos AE.jsx')));
});
test('isolated install verifies every owned file, preserves unrelated content and backs up old panel',{skip:!hasPS},t=>{
  const f=fixture(t),scripts=path.join(f.app,'Support Files','Scripts'),panels=path.join(scripts,'ScriptUI Panels');fs.mkdirSync(panels,{recursive:true});fs.writeFileSync(path.join(panels,'Atalhos AE.jsx'),'old panel');fs.writeFileSync(path.join(scripts,'Other plugin.jsx'),'untouched');
  const result=JSON.parse(ps(planScript(f,"Invoke-AtalhosAEPlan $plan "+psQuote(f.backup)+" | ConvertTo-Json -Depth 4 -Compress")));
  assert.ok(result.Count>=13);assert.equal(hash(path.join(panels,'Atalhos AE.jsx')),hash(path.join(f.source,'Atalhos AE.jsx')));assert.equal(hash(path.join(scripts,'zz Atalhos AE - NULL.jsx')),hash(path.join(f.source,'zz Atalhos AE - NULL.jsx')));
  assert.equal(fs.readFileSync(path.join(scripts,'Other plugin.jsx'),'utf8'),'untouched');
  assert.ok(fs.readdirSync(result.Backup).some(n=>fs.readFileSync(path.join(result.Backup,n),'utf8')==='old panel'));
  assert.ok(!fs.readdirSync(panels).some(n=>n.startsWith('.AtalhosAE-install-')));
});
test('incomplete archive is rejected before changing application files',{skip:!hasPS},t=>{
  const f=fixture(t);fs.unlinkSync(path.join(f.source,'Atalhos AE-assets','null-action.jsxinc'));
  const output=ps("$ErrorActionPreference='Stop'; . "+psQuote(installer)+"; try { New-AtalhosAEPlan "+[f.source,f.app,f.prefs,'27.0'].map(psQuote).join(' ')+"; throw 'unexpected success' } catch { if($_.Exception.Message -eq 'unexpected success'){throw}; Write-Output 'Rejected missing helper' }");
  assert.match(output,/Rejected/);assert.equal(fs.existsSync(path.join(f.app,'Support Files','Scripts')),false);
});
test('Mac launcher is Bash-compatible and retains per-file security, backup and no-runtime approach',()=>{
  const s=fs.readFileSync(mac,'utf8');const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';const r=cp.spawnSync(bash,['-n',mac],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);
  assert.ok(s.startsWith('#!/bin/bash\n'));assert.ok(!/\r/.test(s));assert.ok(!/PresetEffects\.xml|spctl|xattr|brew install|curl|npm install|pkill|killall/.test(s));
  assert.match(s,/administrator privileges/);assert.match(s,/quoted form of/);assert.match(s,/backups/);assert.match(s,/shasum -a 256/);assert.match(s,/--after-effects-app/);assert.match(s,/pgrep -x 'After Effects'/);
});
test('native macOS fixture installs into an isolated fake Adobe product folder and preserves upgrade backups',{skip:process.platform!=='darwin'},t=>{
  const f=fixture(t),home=path.join(f.dir,'fake-user'),app=path.join(f.app,'Adobe After Effects 2027.app');
  fs.mkdirSync(path.join(app,'Contents'),{recursive:true});fs.mkdirSync(home,{recursive:true});
  fs.writeFileSync(path.join(app,'Contents','Info.plist'),'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleShortVersionString</key><string>27.0</string></dict></plist>');
  const args=[mac,'--copy-owned',f.source,app,home];
  const run=()=>{const r=cp.spawnSync('/bin/bash',args,{encoding:'utf8',maxBuffer:1024*1024});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);};
  run();
  const panel=path.join(f.app,'Scripts','ScriptUI Panels','Atalhos AE.jsx'),menu=path.join(f.app,'Scripts','zz Atalhos AE - NULL.jsx');
  assert.equal(hash(panel),hash(path.join(f.source,'Atalhos AE.jsx')));assert.equal(hash(menu),hash(path.join(f.source,'zz Atalhos AE - NULL.jsx')));
  fs.writeFileSync(panel,'old custom panel');run();assert.equal(hash(panel),hash(path.join(f.source,'Atalhos AE.jsx')));
  const backup=path.join(home,'Library','Application Support','Yleo Tools','Atalhos AE','backups');
  assert.ok(fs.readdirSync(backup).some(dir=>fs.readdirSync(path.join(backup,dir)).some(file=>fs.readFileSync(path.join(backup,dir,file),'utf8')==='old custom panel')));
  assert.equal(fs.existsSync(path.join(app,'Contents','Resources','Scripts')),false,'signed application bundle remains untouched');
});
