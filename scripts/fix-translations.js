const fs=require('fs'),path=require('path')
const PT=String.fromCharCode(114,101,116,111,114,110,97,114)
const EN=String.fromCharCode(114,101,116,117,114,110)
const F=[[PT+' (',EN+' ('],[PT+'(',EN+'('],[PT+' null',EN+' null'],[PT+' false',EN+' false'],[PT+' true',EN+' true'],[PT+' nulo',EN+' null'],[PT+' falso',EN+' false'],[PT+' verdadeiro',EN+' true']]
const files=[]
function w(d){if(!fs.existsSync(d))return;fs.readdirSync(d).forEach(n=>{const p=path.join(d,n);fs.statSync(p).isDirectory()?w(p):(n.endsWith('.tsx')||n.endsWith('.ts'))&&files.push(p)})}
w('src')
let c=0
files.forEach(f=>{let s=fs.readFileSync(f,'utf8'),h=false;F.forEach(([a,b])=>{if(s.includes(a)){s=s.split(a).join(b);h=true}});if(h){fs.writeFileSync(f,s,'utf8');c++;process.stdout.write('fixed:'+f+'\n')}})
process.stdout.write('done:'+c+'\n')
