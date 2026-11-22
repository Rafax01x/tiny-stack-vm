import{readdirSync,readFileSync,writeFileSync,mkdirSync}from'node:fs'
const I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output'
function R(p,q){
let s=[],c=[],m=new Int32Array(256),o='',ip=0,pc=0,t=0
for(;;){
if(t==1e6)return[o,10]
if(pc<0||pc>=p.length)return[o,9]
let v=p[pc]
if(!(v<8||v>15&&v<35||v>47&&v<53||v>63&&v<66||v>79&&v<84))return[o,5]
let im=v==1?1:v==2?4:v>47&&v<52?2:0
if(pc+im>=p.length)return[o,9]
t++
let n=v==7?3:v<3||v==48||v==51||v==52||v==82?0:v==5||v==6||v==65||v>15&&v<35&&v!=23&&v!=27?2:1
let u=v==6||v==7?3:v==4||v==5?2:v==0||v==3||v>47&&v<66&&v!=64||v>79&&v!=82?0:1
if(s.length<n)return[o,2]
if(s.length-n+u>256)return[o,3]
let nx=pc+1+im;pc=nx
switch(v){
case 0:return[o,0]
case 1:s.push((p[nx-1]<<24)>>24);break
case 2:s.push(p[nx-4]|p[nx-3]<<8|p[nx-2]<<16|p[nx-1]<<24);break
case 3:s.pop();break
case 4:s.push(s[s.length-1]);break
case 5:s.push(s.pop(),s.pop());break
case 6:s.push(s[s.length-2]);break
case 7:s.push(s.splice(-3,1)[0]);break
case 23:s.push(-s.pop()|0);break
case 27:s.push(~s.pop());break
case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:case 28:case 29:case 30:case 32:case 33:case 34:{
let b=s.pop(),a=s.pop(),r
if(!b&&v>18&&v<23)return[o,4]
if(v==16)r=a+b|0
else if(v==17)r=a-b|0
else if(v==18)r=Math.imul(a,b)
else if(v==19)r=(a/b)|0
else if(v==20)r=b==-1?0:a%b|0
else if(v==21)r=Math.floor((a>>>0)/(b>>>0))|0
else if(v==22)r=(a>>>0)%(b>>>0)|0
else if(v==24)r=a&b
else if(v==25)r=a|b
else if(v==26)r=a^b
else if(v==28)r=a<<(b&31)
else if(v==29)r=a>>(b&31)
else if(v==30)r=(a>>>(b&31))|0
else if(v==32)r=a==b?1:0
else if(v==33)r=a<b?1:0
else r=(a>>>0)<(b>>>0)?1:0
s.push(r);break}
case 48:case 49:case 50:{
let w=v==48||(s.pop()==0)==(v==49)
if(w)pc=nx+(((p[nx-2]|p[nx-1]<<8)<<16)>>16)
break}
case 51:if(c.length==64)return[o,7];c.push(nx);pc=p[nx-2]|p[nx-1]<<8;break
case 52:if(!c.length)return[o,8];pc=c.pop();break
case 64:{let a=s.pop();if(a<0||a>255)return[o,6];s.push(m[a]);break}
case 65:{let a=s.pop(),w=s.pop();if(a<0||a>255)return[o,6];m[a]=w;break}
case 80:{let w=s.pop(),d=''+w;if(o.length+d.length>65536)return[o,11];o+=d;break}
case 81:if(o.length+1>65536)return[o,11];o+=String.fromCharCode(s.pop()&255);break
case 82:s.push(ip<q.length?q[ip++]:-1);break
case 83:return[o,s.pop()&255]
}}}
for(const d of readdirSync(I).sort()){
let g=R(readFileSync(`${I}/${d}/program.bin`),readFileSync(`${I}/${d}/input.bin`))
mkdirSync(`${O}/${d}`,{recursive:true})
writeFileSync(`${O}/${d}/stdout.bin`,Buffer.from(g[0],'latin1'))
writeFileSync(`${O}/${d}/exit.txt`,g[1]+'\n')
}
