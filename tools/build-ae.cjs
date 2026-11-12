"use strict";
// Developer-only dependency-free ZIP builder. Runtime needs only After Effects.
const fs=require("node:fs"),path=require("node:path"),zlib=require("node:zlib"),crypto=require("node:crypto");
const common=["Atalhos AE.jsx","zz Atalhos AE - NULL.jsx","Atalhos AE.release.json","README.md","LEIA-ME.txt","LICENSE"];
function runtimeFiles(root,platform){
  if(!["Windows","macOS"].includes(platform))throw Error("Invalid platform");
  const assets=fs.readdirSync(path.join(root,"Atalhos AE-assets")).filter(name=>/^[a-z0-9-]+\.png$/.test(name)||name==="null-action.jsxinc").map(name=>"Atalhos AE-assets/"+name);
  if(!assets.includes("Atalhos AE-assets/null-action.jsxinc")||assets.length<10)throw Error("Panel assets incomplete");
  return common.concat(assets,platform==="Windows"?["INSTALAR.bat","install.ps1"]:["INSTALAR.command"]);
}
function sourceFiles(root){
  return Array.from(new Set(runtimeFiles(root,"Windows").concat(runtimeFiles(root,"macOS"),["Airrack Letras.pseudo-effect.xml","tools/build-ae.cjs","tools/test-ae-null.cjs","tools/test-ae-install.cjs"])));
}
function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function archive(root,files){
  const chunks=[],central=[];let offset=0;
  for(const relative of files){
    if(!/^[\w .\-/]+$/.test(relative)||relative.split('/').some(p=>p==='..'||!p))throw Error("Unsafe source path");
    const full=path.join(root,relative);if(fs.lstatSync(full).isSymbolicLink()||!fs.statSync(full).isFile())throw Error("Only regular files allowed: "+relative);
    let data=fs.readFileSync(full);
    if(relative.endsWith('.command'))data=Buffer.from(data.toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n'));
    const name=Buffer.from('Atalhos AE/'+relative),compressed=zlib.deflateRawSync(data,{level:9}),crc=crc32(data),header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(0x21,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
    chunks.push(header,name,compressed);
    const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50);dir.writeUInt16LE(0x0314,4);dir.writeUInt16LE(20,6);dir.writeUInt16LE(0x800,8);dir.writeUInt16LE(8,10);dir.writeUInt16LE(0x21,14);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(compressed.length,20);dir.writeUInt32LE(data.length,24);dir.writeUInt16LE(name.length,28);dir.writeUInt32LE(((relative.endsWith('.command')?0x81ed:0x81a4)<<16)>>>0,38);dir.writeUInt32LE(offset,42);
    central.push(dir,name);offset+=header.length+name.length+compressed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  const zip=Buffer.concat(chunks.concat([directory,end]));
  // Re-read every local record and verify uncompressed content/CRC; no silent
  // truncation, unrelated sibling repos, credentials, logs or user projects.
  let cursor=0;
  for(const relative of files){const n=zip.readUInt16LE(cursor+26),size=zip.readUInt32LE(cursor+18),start=cursor+30+n;const output=zlib.inflateRawSync(zip.subarray(start,start+size));if(crc32(output)!==zip.readUInt32LE(cursor+14)||output.length!==zip.readUInt32LE(cursor+22))throw Error("Archive readback failed: "+relative);cursor=start+size;}
  if(cursor!==offset)throw Error("Archive offset mismatch");return zip;
}
function build(root,out,force=false){
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'Atalhos AE.release.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(metadata.version))throw Error("Invalid version");
  const plans=[['Windows',runtimeFiles(root,'Windows')],['macOS',runtimeFiles(root,'macOS')],['codigo',sourceFiles(root)]];
  for(const [suffix] of plans)if(fs.existsSync(path.join(out,'Atalhos-AE-'+metadata.version+'-'+suffix+'.zip'))&&!force)throw Error("Artifact exists; use --force to deliberately rebuild");
  fs.mkdirSync(out,{recursive:true});const hashes=[];
  for(const [suffix,files] of plans){const name='Atalhos-AE-'+metadata.version+'-'+suffix+'.zip',data=archive(root,files),digest=crypto.createHash('sha256').update(data).digest('hex');fs.writeFileSync(path.join(out,name),data);hashes.push(digest+'  '+name);console.log(name+' ('+data.length+' bytes, SHA256 '+digest+')');}
  fs.writeFileSync(path.join(out,'Atalhos-AE-'+metadata.version+'-SHA256SUMS.txt'),hashes.join('\n')+'\n');
}
if(require.main===module){const root=path.resolve(__dirname,'..'),at=process.argv.indexOf('--out');build(root,at<0?path.join(root,'dist'):path.resolve(process.argv[at+1]),process.argv.includes('--force'));}
module.exports={runtimeFiles,sourceFiles,archive,build,crc32};
