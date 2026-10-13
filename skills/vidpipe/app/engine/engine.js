/* vidpipe engine — data-driven explainer video scenes.
   window.SETUP(spec) -> timeline ; window.render(t) draws frame at t seconds. */
const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const P=(t,a,b)=>clamp((t-a)/(b-a));
const L=(a,b,x)=>a+(b-a)*x;
const E={outExpo:x=>x>=1?1:1-Math.pow(2,-10*x),inExpo:x=>x<=0?0:Math.pow(2,10*x-10),
 inOutExpo:x=>x<=0?0:x>=1?1:x<.5?Math.pow(2,20*x-10)/2:(2-Math.pow(2,-20*x+10))/2,
 outCubic:x=>1-Math.pow(1-x,3),inOutCubic:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,inCubic:x=>x*x*x,
 outBack:(x,c=1.7)=>1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const tf=(el,s)=>el.style.transform=s, op=(el,o)=>el.style.opacity=o, show=(el,v)=>el.style.display=v?'':'none';
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const el=(tag,cls,html,parent)=>{const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; if(parent) parent.appendChild(e); return e;};

/* ---------- reading rule ---------- */
const RULE={base:0.7,wps:3};
const words=s=>!s?0:String(s).trim().split(/\s+/).filter(Boolean).length;
const need=w=>RULE.base+w/RULE.wps;
const CAP_IN=0.55, EXIT=0.3, OVL=0.25;

/* ---------- palette for tokens ---------- */
const HUES=[[252,'#6b5cf0','#ebe8ff'],[168,'#14957d','#dcf3ee'],[36,'#cf8410','#fff0d6'],[346,'#dd4469','#ffe2e8'],[214,'#2f78e3','#e2eeff'],[80,'#6f8a12','#eef4d8']];
const hue=i=>HUES[i%HUES.length];
const tok=t=>{const s=String(t); return s.startsWith(' ')?{dot:1,text:s.slice(1)}:{dot:0,text:s};};
const tlen=t=>{const k=tok(t); return k.text.length+k.dot;};
const chipW=(n,fs,k=1)=>fs*(0.6*n+0.8*k)+4, chipH=(fs,k=1)=>fs*(1.2+0.36*k)+4;
function mkChip(t,parent){const k=tok(t); const c=el('div','chip',`<span class="dt">${k.dot?'·':''}</span><span class="tx">${esc(k.text)}</span>`,parent); c.__n=k.text.length+k.dot; return c;}
function setChip(c,{cx,cy,fs,k=1,bg='var(--card)',bd='var(--ink)',col='var(--ink)',o=1,s=1}){
  const w=c.__n*fs*0.6+fs*0.8*k+4, h=chipH(fs,k);
  c.style.fontSize=fs+'px'; c.style.padding=`${.18*k}em ${.4*k}em`;
  c.style.left=(cx-w/2)+'px'; c.style.top=(cy-h/2)+'px';
  c.style.background=bg; c.style.borderColor=bd; c.style.color=col; op(c,o); tf(c,`scale(${s})`);
  return {w,h};
}
function rowCenters(toks,fs,gap,cx){const ws=toks.map(t=>chipW(tlen(t),fs)); const tot=ws.reduce((a,b)=>a+b,0)+gap*(ws.length-1); let x=cx-tot/2; return ws.map(w=>{const c=x+w/2; x+=w+gap; return c;});}
function fitFs(toks,gap,maxW,maxFs){let fs=maxFs; const tot=f=>toks.reduce((a,t)=>a+chipW(tlen(t),f),0)+gap*(toks.length-1); while(fs>MIN_FS&&tot(fs)>maxW) fs-=1; if(tot(fs)>maxW) warn(`${toks.length} tokens don't fit one row at a readable size; use fewer or shorter tokens`); return fs;}
function roll(w,u,a,d,dur=0.5){const x=E.outExpo(P(u,a,a+dur)),o=E.inExpo(P(u,d-0.3,d)); tf(w,`translateY(${(1-x)*110-o*110}%)`);}
function mask(text,cls,parent,style=''){return el('div',cls,`<span class="m"><span class="w">${esc(text)}</span></span>`,parent);}
const fmtNum=(v,d,u='')=>(typeof v==='number'?v.toFixed(d):v)+u;

let uc,fx; // canvases
// theme colours for canvas drawing, read from the CSS vars at SETUP so spec.theme applies everywhere
const C={acc:'255,90,31',ink:'23,23,28',accHex:'#ff5a1f',inkHex:'#17171c'};
const rgb=h=>{h=String(h).trim().replace('#',''); if(h.length===3) h=[...h].map(c=>c+c).join(''); const n=parseInt(h,16); return [n>>16&255,n>>8&255,n&255].join(',');};
/* readability: nothing may render smaller than MIN_FS (in 1080p px; 720p shows 2/3 of it) */
const MIN_FS=26, WARN=[]; let CUR=-1;
const warn=m=>WARN.push({scene:CUR,msg:m});

/* ================= SCENE TYPES =================
 Each type: plan(sc) -> {landed, vis:[[label,words,fullyInAt]], min, fast:[[a,b]], cap2?:time, chap?:[...]}
            build(sc,root), render(sc,u,D,ex)  (u = local time, D = duration, ex = exit progress 0..1)   */
const T={};

T.title={
  plan:sc=>({noCaption:true,landed:0.85,vis:[['title',words(sc.title)+words(sc.sub),0.85]]}),
  build(sc,r){sc._t=mask(sc.title,'abs',r); Object.assign(sc._t.style,{top:'420px',width:'1920px',textAlign:'center',fontSize:'168px',fontWeight:650,letterSpacing:'-.05em'});
    const tw=sc._t.querySelector('.w').offsetWidth; if(tw>1640){const f=168*1640/tw; if(f<90) warn('title too long: shorten it'); sc._t.style.fontSize=f+'px'; sc._t.style.top=(420+(168-f)*0.5)+'px';}
    if(sc.sub){sc._s=el('div','abs ser',esc(sc.sub),r); Object.assign(sc._s.style,{top:'660px',width:'1920px',textAlign:'center',fontSize:'52px',color:'var(--mute)'});}},
  render(sc,u,D){const w=sc._t.querySelector('.w'); roll(w,u,0.2,D+0.05,0.65);
    if(sc._s){const x=E.outCubic(P(u,0.6,1.0))*(1-P(u,D-0.3,D)); op(sc._s,x); tf(sc._s,`translateY(${(1-x)*20}px)`);}
    const r=w.getBoundingClientRect(), s=window.__scale; if(Math.floor(u/0.45)%2===0&&u>0.85&&u<D-0.3){fx.fillStyle=C.accHex; fx.fillRect(r.right/s+14,r.top/s+r.height/s*0.18,10,r.height/s*0.62);} }
};

T.statement={
  plan:sc=>{const n=String(sc.text).split('\n').length; return {landed:0.6+0.1*n,vis:[['statement',words(sc.text)+words(sc.sub),0.6+0.1*n]]};},
  build(sc,r){const lines=String(sc.text).split('\n'); const fs=sc.size||110, top=540-(lines.length*fs*1.05)/2-(sc.sub?40:0);
    sc._l=lines.map((ln,i)=>{const d=mask(ln,'abs',r); Object.assign(d.style,{top:(top+i*fs*1.05)+'px',width:'1920px',textAlign:'center',fontSize:fs+'px',fontWeight:640,letterSpacing:'-.045em',lineHeight:1,color:i===sc.muteLine?'var(--mute)':'var(--ink)'}); return d;});
    const mw=Math.max(...sc._l.map(d=>d.querySelector('.w').offsetWidth)); if(mw>1640||fs<64){const f=Math.min(fs,fs*1640/mw); if(f<64) warn('statement line too long or size too small: split it with \\n or cut words'); const t2=540-(lines.length*f*1.05)/2-(sc.sub?40:0); sc._l.forEach((d,i)=>{d.style.fontSize=f+'px'; d.style.top=(t2+i*f*1.05)+'px';});}
    if(sc.sub){const f=parseFloat(sc._l[0].style.fontSize), lt=parseFloat(sc._l[sc._l.length-1].style.top); sc._s=el('div','abs',esc(sc.sub),r); Object.assign(sc._s.style,{top:(lt+f*1.05+40)+'px',width:'1920px',textAlign:'center',fontSize:'40px',color:'var(--mute)'});}},
  render(sc,u){sc._l.forEach((d,i)=>roll(d.querySelector('.w'),u,0.05+i*0.1,1e9,0.6)); if(sc._s){const x=E.outCubic(P(u,0.5,0.8)); op(sc._s,x);}}
};

T.matrix={
  plan:sc=>({landed:1.1,vis:[['card',words(sc.label)+words(sc.meta),1.1]]}),
  build(sc,r){const c=el('div','card',`<div style="position:absolute;left:0;right:0;top:0;height:66px;border-bottom:2px solid var(--ink);display:flex;align-items:center;justify-content:space-between;padding:0 28px;font-family:Mono;font-size:26px"><span>${esc(sc.label||'')}</span><span style="color:var(--mute)">${esc(sc.meta||'')}</span></div><div class="mb" style="position:absolute;left:0;right:0;top:66px;bottom:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,#000 80%,transparent 97%)"><div class="g" style="position:absolute;left:44px;top:0;font-family:Mono;font-size:21px;line-height:34px;white-space:pre;color:#3a3a40"></div></div>`,r);
    Object.assign(c.style,{left:'520px',top:'350px',width:'880px',height:'470px',overflow:'hidden'});
    const R=rng(sc.seed||11); let g=''; for(let i=0;i<26;i++){let ln=''; for(let j=0;j<8;j++){const v=(R()-.5)*.5; ln+=(v<0?'−':' ')+Math.abs(v).toFixed(4)+'   ';} g+=ln+'\n';}
    c.querySelector('.g').textContent=g+g; sc._c=c;},
  render(sc,u){const i=E.outExpo(P(sc._u=u,0.2,0.85)); tf(sc._c,`scale(${L(.9,1,i)})`); op(sc._c,clamp(P(u,0.2,0.35)));
    const g=sc._c.querySelector('.g'); op(g,E.outCubic(P(u,0.5,1.1))); tf(g,`translateY(${-(u*18)%(26*34)}px)`);}
};

T.tokens={
  plan:sc=>{const prompt=sc.prompt||sc.tokens.join(''); const tEnd=0.55+prompt.length*0.03, mEnd=tEnd+0.1+0.55, sEnd=mEnd+0.35+sc.tokens.length*0.04;
    sc._tm={tEnd,mEnd,sEnd,prompt}; const vis=[['prompt',words(prompt),tEnd]]; vis.push(['tokens',sc.tokens.length,mEnd]); if(sc.sub) vis.push(['sub-labels',sc.sub.length,sEnd]);
    return {landed:sEnd,vis,fast:[[tEnd,sEnd]]};},
  build(sc,r){const fs=sc._fs=fitFs(sc.tokens,26,1640,46); sc._row=rowCenters(sc.tokens,fs,26,960);
    const pw=Math.min(1640,Math.max(1160,sc._tm.prompt.length*0.6*fs+140)); sc._bx=960-pw/2;
    sc._box=el('div','card',null,r); Object.assign(sc._box.style,{left:sc._bx+'px',top:'492px',width:pw+'px',height:'136px',borderRadius:'22px'});
    sc._lab=el('div','lbl',esc(sc.label||'Prompt'),r); Object.assign(sc._lab.style,{left:sc._bx+'px',top:'452px'});
    sc._c=sc.tokens.map(t=>mkChip(t,r)); sc._s=(sc.sub||[]).map(v=>el('div','sub',esc(v),r));
    let ci=0; sc._cst=sc.tokens.map(t=>{const s=ci; ci+=t.length; return s;});},
  render(sc,u){const {tEnd,mEnd}=sc._tm, fs=sc._fs, cw=fs*0.6;
    const bi=E.outExpo(P(u,0.15,0.6)), bo=E.inOutExpo(P(u,tEnd+0.1,tEnd+0.5));
    op(sc._box,bi*(1-bo)); tf(sc._box,`translateY(${(1-bi)*30}px) scaleY(${L(1,0.02,bo)})`); op(sc._lab,bi*(1-bo));
    const nT=Math.floor(clamp((u-0.55)/0.03,0,sc._tm.prompt.length)); const sk=E.inOutExpo(P(u,tEnd+0.1,tEnd+0.65));
    sc._c.forEach((c,i)=>{const k=tok(sc.tokens[i]); const st=sc._cst[i]; const chars=clamp(nT-st,0,sc.tokens[i].length); const shown=k.dot?Math.max(0,chars-1):chars;
      c.querySelector('.tx').textContent=k.text.slice(0,shown); show(c,u>=0.5);
      const tx=sc._bx+60+st*cw, wT=chipW(c.__n,fs,0);
      const h=hue(i); setChip(c,{cx:L(tx+wT/2-2,sc._row[i],sk),cy:560,fs,k:sk,bg:sk>0?h[2]:'transparent',bd:sk>0?h[1]:'transparent'});
      c.querySelector('.dt').style.opacity=0.45*sk;});
    if(u>=0.45&&u<tEnd+0.1){const c=Math.min(nT,sc._tm.prompt.length); if(Math.floor(u/0.25)%2===0||nT<sc._tm.prompt.length){fx.fillStyle=C.inkHex; fx.fillRect(sc._bx+60+c*cw+2,532,4,58);}}
    sc._s.forEach((s,i)=>{const io=E.outExpo(P(u,mEnd+i*0.04,mEnd+0.35+i*0.04)); op(s,io); s.style.left=(sc._row[i]-120)+'px'; s.style.top=(620+(1-io)*16)+'px';});}
};

T.columns={
  plan:sc=>{const c=[].concat(sc.caption||[]); const c2=sc.cap2At||Math.max(1.7,CAP_IN+need(words(c[0]))-0.6); const sweep=sc.sweep||2.5;
    sc._tm={c2,p0:c2+0.3,p1:c2+0.3+sweep};
    return {landed:1.3,vis:[],cap2:c2,min:c2+0.3+sweep+0.35,fast:[[0,0.7],[c2+0.3,c2+0.3+sweep]],split:c2};},
  build(sc,r){const n=sc.tokens.length, fs=sc._fs=fitFs(sc.tokens,92,1300,34); sc._row=rowCenters(sc.tokens,fs,Math.min(92,Math.max(30,(1300-sc.tokens.reduce((a,t)=>a+chipW(tlen(t),fs),0))/Math.max(1,n-1))),960);
    sc._c=sc.tokens.map(t=>mkChip(t,r)); sc._cols=sc.tokens.map(()=>{const c=el('div',null,'<b></b>'.repeat(sc.cells||12),r); Object.assign(c.style,{position:'absolute',width:'54px',display:'flex',flexDirection:'column',gap:'4px'}); [...c.children].forEach(b=>Object.assign(b.style,{display:'block',height:'22px',borderRadius:'4px'})); return c;});
    const R=rng(5); sc._cell=sc.tokens.map(()=>[...Array(sc.cells||12)].map(()=>[...Array((sc.layers||30)+1)].map(()=>0.42+R()*0.5)));
    sc._ctr=el('div','abs',`<div class="lbl" style="position:relative">${esc(sc.counter||'Layer')}</div><div style="font-family:Mono;font-size:64px;line-height:1;margin-top:8px"><b class="n" style="font-weight:500">01</b><span style="color:var(--faint);font-size:30px"> / ${sc.layers||30}</span></div>`,r);
    Object.assign(sc._ctr.style,{left:'1600px',top:'560px'});},
  render(sc,u,D,ex){const fs=sc._fs, N=sc.layers||30, m=E.inOutExpo(P(u,0,0.5));
    const travel=E.inOutCubic(P(u,sc._tm.p0,sc._tm.p1)), pY=k=>-40-k*46+travel*(1000+(N-1)*46+40);
    const passed=y=>{let n=0; for(let k=0;k<N;k++) if(pY(k)>y) n++; return Math.min(n,N);};
    sc._c.forEach((c,i)=>{const h=hue(i); const o=E.outCubic(P(u,0.05+i*0.05,0.4+i*0.05)); setChip(c,{cx:sc._row[i],cy:900+(1-o)*30,fs,bg:h[2],bd:h[1],o});
      const col=sc._cols[i]; col.style.left=(sc._row[i]-27)+'px'; const top=900-chipH(fs)/2-14-(sc.cells||12)*26+4; col.style.top=top+'px';
      [...col.children].forEach((b,j)=>{const g=E.outExpo(P(u,0.3+i*0.08+((sc.cells||12)-1-j)*0.04,0.7+i*0.08+((sc.cells||12)-1-j)*0.04));
        const l=sc._cell[i][j][passed(top+j*26+11)]; b.style.background=`hsl(${h[0]} ${L(85,60,l)}% ${L(42,92,1.42-l)}%)`; tf(b,`scaleX(${g})`); b.style.opacity=g;});});
    const pv=u>=sc._tm.p0-0.1; show(sc._ctr,pv); if(pv){op(sc._ctr,E.outCubic(P(u,sc._tm.p0-0.05,sc._tm.p0+0.25))); sc._ctr.querySelector('.n').textContent=String(Math.max(1,passed(700))).padStart(2,'0');
      uc.globalAlpha=1-ex; for(let k=0;k<N;k++){const y=pY(k); if(y<300||y>960) continue; const near=Math.max(0,1-Math.abs(y-700)/170);
        uc.strokeStyle=near>0.02?`rgba(${C.acc},${0.25+0.6*near})`:`rgba(${C.ink},.16)`; uc.lineWidth=near>0.02?3:2; uc.beginPath(); uc.moveTo(330,y); uc.lineTo(1520,y); uc.stroke();}
      uc.globalAlpha=1;
      if(sc.attention!==false){let a=0; for(let k=0;k<N;k++) a=Math.max(a,1-Math.abs(pY(k)-620)/140); a=clamp(a)*(1-ex);
        if(a>0.02){const ar=rng(1000+passed(700)); const tops=sc._cols.map(c=>[parseFloat(c.style.left)+27,parseFloat(c.style.top)-10]);
          for(let i=1;i<tops.length;i++) for(let j=0;j<i;j++){const w=ar(); if(w<0.35) continue; const [x1,y1]=tops[i],[x0,y0]=tops[j];
            fx.strokeStyle=`rgba(${C.acc},${a*(0.25+0.6*w)})`; fx.lineWidth=1.5+2.5*w; fx.beginPath(); fx.moveTo(x1,y1); fx.quadraticCurveTo((x0+x1)/2,y1-70-(x1-x0)*0.18,x0,y0); fx.stroke();}}}}}
};

T.bars={
  plan:sc=>{const n=sc.rows.length, landed=0.75+n*0.08+0.7; return {landed,vis:[['rows',n*2+words(sc.header),landed]],fast:[[0.6,landed]]};},
  build(sc,r){sc._src=sc.source?mkChip(sc.source,r):null;
    if(sc._src){sc._col=el('div',null,'<b></b>'.repeat(12),r); Object.assign(sc._col.style,{position:'absolute',width:'54px',display:'flex',flexDirection:'column',gap:'4px'}); [...sc._col.children].forEach((b,j)=>Object.assign(b.style,{display:'block',height:'22px',borderRadius:'4px',background:`hsl(214 70% ${55+((j*37)%35)}%)`}));}
    if(sc.header){sc._h=el('div','lbl',esc(sc.header),r); Object.assign(sc._h.style,{left:'640px',top:'360px'});}
    sc._rows=sc.rows.map(([lab,v])=>({c:mkChip(lab,r),b:el('div','bar',null,r),v:el('div','val',null,r)}));},
  render(sc,u,D,ex){const n=sc.rows.length, step=Math.min(95,470/Math.max(1,n-1)), y0=n>1?Math.max(430,640-step*(n-1)/2):640, max=sc.max||Math.max(...sc.rows.map(r=>+r[1]||0)), sc_=760/max;
    if(sc._h) op(sc._h,E.outCubic(P(u,0.7,1.0)));
    const hl=sc.highlight??0;
    if(sc._src){const o=E.outExpo(P(u,0.1,0.6)); setChip(sc._src,{cx:300,cy:880+(1-o)*30,fs:34,bg:'#e2eeff',bd:'#2f78e3',o}); sc._col.style.left='273px'; sc._col.style.top=(880-30-14-308+(1-o)*30)+'px'; op(sc._col,o);}
    sc._rows.forEach((R,i)=>{const a=0.75+i*0.08, g=E.outExpo(P(u,a,a+0.7)), o=E.outCubic(P(u,a-0.1,a+0.15)), y=y0+i*step, isH=i===hl;
      const lab=sc.rows[i][0], w=chipW(tlen(lab),36);
      setChip(R.c,{cx:820-w/2,cy:y,fs:36,bg:isH?'var(--acc)':'var(--card)',bd:isH?'var(--acc)':'var(--ink)',col:isH?'#fff':'var(--ink)',o});
      const v=+sc.rows[i][1]||0, bw=Math.max(4,v*sc_); Object.assign(R.b.style,{left:'850px',top:(y-22)+'px',width:bw+'px',background:isH?'var(--acc)':'var(--ink)'}); op(R.b,o*(isH?1:0.82)); tf(R.b,`scaleX(${g})`);
      R.v.textContent=fmtNum(sc.rows[i][1],sc.decimals??1,sc.unit??''); Object.assign(R.v.style,{left:(850+bw*g+18)+'px',top:(y-21)+'px'}); op(R.v,o*E.outCubic(P(u,a+0.3,a+0.6)));
      if(sc._src&&o>0){uc.strokeStyle=`rgba(${C.ink},${0.14*o*(1-ex)})`; uc.lineWidth=2; uc.beginPath(); uc.moveTo(340,720); uc.bezierCurveTo(520,720,560,y,820-w-14,y); uc.stroke();}});}
};

T.steps={
  plan:sc=>{const n=sc.rows.length; let t=0.85; const holds=[],moves=[],vis=[]; sc.stops.forEach((s,i)=>{if(i>0){moves.push([t,t+0.5]); t+=0.5+0.15;} const h=s.hold!=null?s.hold:need(n+words(s.label)); if(s.hold==null) vis.push([`stop ${s.at}`,n+words(s.label),t]); else vis.push(null); holds.push([t,t+h]); t+=h+0.15;});
    vis.forEach((v,i)=>{if(v&&i<moves.length) v.push(moves[i][0]-0.15);});
    sc._tm={holds,moves}; return {landed:0.85,vis:[['slider labels',2+words(sc.label),0.85]].concat(vis.filter(Boolean)),min:t,fast:moves.map(([a,b])=>[a-0.05,b+0.1]).concat([[0,0.7]])};},
  build(sc,r){sc._rows=sc.rows.map(l=>({c:mkChip(l,r),b:el('div','bar',null,r),v:el('div','val',null,r)}));
    sc._ax=[0,50,100].map(p=>({l:el('div',null,null,r),t:el('div','lbl',`${Math.round(p/100*(sc.axisMax||100))}${sc.unit??'%'}`,r)}));
    sc._trk=el('div',null,null,r); Object.assign(sc._trk.style,{position:'absolute',left:'850px',top:'788px',width:'800px',height:'6px',borderRadius:'3px',background:'var(--line)',transformOrigin:'0 50%'});
    const tk=sc.ticks||sc.stops.map(s=>s.at).sort((a,b)=>a-b); sc._min=Math.min(...tk); sc._max=Math.max(...tk);
    sc._tk=tk.map(v=>{const x=850+(v-sc._min)/(sc._max-sc._min)*800; const l=el('div',null,null,r); Object.assign(l.style,{position:'absolute',left:(x-1)+'px',top:'772px',width:'2px',height:'38px',background:'var(--faint)'});
      const t=el('div',null,String(v),r); Object.assign(t.style,{position:'absolute',left:(x-50)+'px',top:'722px',width:'100px',textAlign:'center',fontFamily:'Mono',fontSize:'26px'}); return {l,t,v};});
    sc._lab=el('div','lbl',esc(sc.label||''),r); Object.assign(sc._lab.style,{left:'0px',width:'820px',textAlign:'right',top:'778px'});
    sc._k=el('div',null,null,r); Object.assign(sc._k.style,{position:'absolute',width:'40px',height:'40px',borderRadius:'50%',background:'var(--ink)',boxShadow:'0 0 0 6px var(--accT),0 0 0 8px var(--acc)',top:'771px'});
    sc._ends=(sc.ends||[]).map((s,i)=>{const e=el('div','abs ser',esc(s),r); Object.assign(e.style,{top:'830px',fontSize:'38px',color:'var(--mute)'}); if(i===0) e.style.left='850px'; else {e.style.left='1650px'; e.style.transform='translateX(-100%)';} return e;});},
  render(sc,u){const {holds,moves}=sc._tm, si=E.outExpo(P(u,0.2,0.75)), am=sc.axisMax||100, scale=800/am;
    // current interpolated stop
    let a=0,b=0,p=0; for(let i=0;i<moves.length;i++){if(u>=moves[i][0]){a=i;b=i+1;p=E.inOutExpo(P(u,moves[i][0],moves[i][1]));}}
    const cur=i=>L(+sc.stops[a].values[i],+sc.stops[b].values[i],p), at=L(sc.stops[a].at,sc.stops[b].at,p);
    const last=holds.length-1;
    let vi=-1, vo=0; holds.forEach(([x,y],i)=>{const end=i===last?1e9:moves[i][0]; if(u>=x-0.15&&u<end){vi=i; vo=P(u,x-0.15,x)*(1-P(u,end-0.15,end));}});
    sc._rows.forEach((R,i)=>{const y=470+i*120, o=E.outCubic(P(u,0.1+i*0.08,0.4+i*0.08)), isH=i===(sc.highlight??0); const w=chipW(tlen(sc.rows[i]),36);
      setChip(R.c,{cx:820-w/2,cy:y,fs:36,bg:isH?'var(--acc)':'var(--card)',bd:isH?'var(--acc)':'var(--ink)',col:isH?'#fff':'var(--ink)',o});
      const bw=Math.max(4,cur(i)*scale); Object.assign(R.b.style,{left:'850px',top:(y-22)+'px',width:bw+'px',background:isH?'var(--acc)':'var(--ink)'}); op(R.b,o*(isH?1:.82)); tf(R.b,`scaleX(${E.outExpo(P(u,0.2,0.8))})`);
      if(vi>=0){R.v.textContent=fmtNum(+sc.stops[vi].values[i],sc.decimals??1,sc.unit??'%');} Object.assign(R.v.style,{left:(850+bw+18)+'px',top:(y-21)+'px'}); op(R.v,o*vo);});
    sc._ax.forEach(({l,t},i)=>{const x=850+i*400; Object.assign(l.style,{position:'absolute',left:(x-1)+'px',top:'420px',width:'2px',height:(200+(sc.rows.length-2)*120)+'px',background:'var(--line)'}); Object.assign(t.style,{left:(x-50)+'px',width:'100px',textAlign:'center',top:'388px'}); op(l,si); op(t,si);});
    op(sc._trk,si); tf(sc._trk,`scaleX(${si})`); op(sc._lab,si); sc._ends.forEach(e=>op(e,E.outCubic(P(u,0.5,0.8))));
    sc._tk.forEach(k=>{op(k.l,si); op(k.t,si); k.t.style.color=Math.abs(k.v-at)<0.03?'var(--acc)':'var(--ink)';});
    const kx=850+(at-sc._min)/(sc._max-sc._min)*800; sc._k.style.left=(kx-20)+'px'; op(sc._k,si); tf(sc._k,`scale(${L(.4,1,E.outBack(P(u,0.35,0.7)))})`);}
};

T.sequence={
  plan:sc=>{const g=sc.generated.length, first=0.5, gap=sc.gap||0.3, t0=first+(sc.loop!==false?0.9:0.3), apps=sc.generated.map((_,i)=>i===0?first:t0+(i-1)*gap);
    sc._tm={apps}; const lastIn=apps[apps.length-1]+0.45;
    return {landed:0.7,vis:[['generated tokens',g,first+0.45],['note',words(sc.note),1.3]],min:lastIn+0.8,fast:[[0,0.7],[first-0.1,lastIn]]};},
  build(sc,r){sc._all=[...sc.prefix,...sc.generated]; sc._fs=fitFs(sc._all,14,1640,36); sc._c=sc._all.map(t=>mkChip(t,r));
    if(sc.note){sc._n=el('div','lbl',esc(sc.note),r); Object.assign(sc._n.style,{left:'0px',width:'1920px',textAlign:'center',top:'760px'});}},
  render(sc,u,D,ex){const fs=sc._fs, gap=14, apps=sc._tm.apps, P0=sc.prefix.length; let n=P0; apps.forEach((a,i)=>{if(u>=a) n=P0+i+1;});
    const tw=k=>sc._all.slice(0,k).reduce((a,t)=>a+chipW(tlen(t),fs),0)+gap*(k-1);
    const p=n>P0?E.inOutCubic(P(u,apps[n-P0-1],apps[n-P0-1]+0.35)):1; let x0=960-L(tw(Math.max(P0,n-1)),tw(n),p)/2; const xs=[];
    for(let i=0;i<n;i++){const w=chipW(tlen(sc._all[i]),fs); xs.push(x0+w/2); x0+=w+gap;}
    sc._c.forEach((c,i)=>{if(i>=n){show(c,0);return;} show(c,1);
      if(i<P0){const o=E.outExpo(P(u,0.05+i*0.04,0.6+i*0.04)); const h=hue(i); setChip(c,{cx:xs[i],cy:560+(1-o)*40,fs,bg:h[2],bd:h[1],o});}
      else {const a=apps[i-P0], q=P(u,a,a+0.45), e=E.outExpo(q), first=i===P0; setChip(c,{cx:xs[i],cy:560-(1-e)*60,fs,bg:first?'var(--acc)':'var(--accT)',bd:'var(--acc)',col:first?'#fff':'var(--ink)',o:clamp(q*4),s:L(0.6,1,E.outBack(clamp(q*1.2),2))});}});
    if(sc._n) op(sc._n,E.outCubic(P(u,1.0,1.3)));
    if(sc.loop!==false){const ar=E.inOutCubic(P(u,0.85,1.35))*(1-ex); if(ar>0){const last=sc._c[n-1], xe=parseFloat(last.style.left)+last.offsetWidth, xs0=parseFloat(sc._c[0].style.left), y=600;
      fx.strokeStyle=`rgba(${C.acc},${ar})`; fx.lineWidth=3; const path=new Path2D(); path.moveTo(xe-30,y); path.bezierCurveTo(xe+30,y+110,xs0-30,y+110,xs0+20,y+4);
      fx.save(); fx.setLineDash([2400]); fx.lineDashOffset=2400*(1-ar); fx.stroke(path); fx.restore();
      if(ar>0.95){fx.fillStyle=`rgba(${C.acc},${ar})`; fx.beginPath(); fx.moveTo(xs0+20,y); fx.lineTo(xs0+36,y+18); fx.lineTo(xs0+8,y+22); fx.closePath(); fx.fill();}}}}
};

T.heatmap={
  plan:sc=>{const n=sc.rows.length, landed=0.6+n*0.07+0.5; const hw=sc.highlightRow!=null?(sc.cols||sc.rows).length:0;
    return {landed,vis:[['matrix labels',n+hw+words(sc.note),landed]],fast:[[0.2,landed]]};},
  build(sc,r){const cols=sc.cols||sc.rows, n=sc.rows.length, m=cols.length; const cs=sc._cs=Math.min(120,Math.floor(520/n),Math.floor(1000/m)); const fs=sc._fs=Math.min(30,Math.floor(cs*0.62/Math.max(...[...sc.rows,...cols].map(tlen))*1.6)+6); if(n>8||m>8) warn('heatmap over 8 rows or columns: cell text gets too small to read');
    sc._gx=Math.round(1060-m*cs/2+80); sc._gy=Math.round(620-n*cs/2+30);
    sc._rl=sc.rows.map(t=>mkChip(t,r)); sc._cl=cols.map(t=>mkChip(t,r));
    sc._cells=sc.rows.map((_,i)=>cols.map((_,j)=>el('div','cell',null,r)));
    sc._hl=el('div',null,null,r); Object.assign(sc._hl.style,{position:'absolute',border:'4px solid var(--acc)',borderRadius:'12px'});
    if(sc.note){sc._n=el('div','lbl',esc(sc.note),r); Object.assign(sc._n.style,{left:sc._gx+'px',top:(sc._gy+n*cs+26)+'px'});}
    if(sc.colLabel){sc._cL=el('div','lbl',esc(sc.colLabel),r); Object.assign(sc._cL.style,{left:sc._gx+'px',top:(sc._gy-118)+'px'});}},
  render(sc,u){const cs=sc._cs, fs=Math.min(30,Math.max(22,cs*0.26)), cols=sc.cols||sc.rows, max=sc.max||1, gx=sc._gx, gy=sc._gy, d=sc.decimals??2;
    sc._rl.forEach((c,i)=>{const o=E.outCubic(P(u,0.2+i*0.07,0.5+i*0.07)); const w=chipW(c.__n,fs+4); const h=hue(i); setChip(c,{cx:gx-20-w/2,cy:gy+i*cs+cs/2,fs:fs+4,bg:h[2],bd:h[1],o});});
    sc._cl.forEach((c,j)=>{const o=E.outCubic(P(u,0.1+j*0.04,0.4+j*0.04)); const h=hue(j); setChip(c,{cx:gx+j*cs+cs/2,cy:gy-44,fs:Math.min(fs+4,cs*0.9/(0.6*c.__n+0.8)),bg:h[2],bd:h[1],o});});
    sc._cells.forEach((row,i)=>row.forEach((c,j)=>{const a=0.35+i*0.07+j*0.02, e=E.outExpo(P(u,a,a+0.5)); const v=sc.values[i]?.[j]; const masked=sc.causal!==false&&j>i;
      Object.assign(c.style,{left:(gx+j*cs+3)+'px',top:(gy+i*cs+3)+'px',width:(cs-6)+'px',height:(cs-6)+'px',fontSize:fs+'px'});
      if(masked||v==null){c.style.background='repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 9px)'; c.textContent=''; c.style.color='var(--ink)';}
      else {const k=clamp(+v/max); c.style.background=`rgba(${C.acc},${0.08+0.92*k})`; c.style.color=k>0.55?'#fff':'var(--ink)'; c.textContent=(+v).toFixed(d).replace(/^0(?=\.)/,'');}
      op(c,e); tf(c,`scale(${L(.6,1,e)})`);}));
    const hr=sc.highlightRow; if(hr!=null){const e=E.inOutCubic(P(u,0.6+sc.rows.length*0.07+0.3,0.6+sc.rows.length*0.07+0.7)); Object.assign(sc._hl.style,{left:(gx-6)+'px',top:(gy+hr*cs-6)+'px',height:(cs+12)+'px',width:(L(0,cols.length*cs+12,e))+'px'}); op(sc._hl,e>0?1:0);} else show(sc._hl,0);
    if(sc._n) op(sc._n,E.outCubic(P(u,1.0,1.3))); if(sc._cL) op(sc._cL,E.outCubic(P(u,0.3,0.6)));}
};

T.compare={
  plan:sc=>{const n=sc.items.length, landed=0.7+n*0.12+0.8; return {landed,vis:[['items',sc.items.reduce((a,it)=>a+words(it.label)+1+words(it.sub),0),landed]],fast:[[0.3,landed]]};},
  build(sc,r){sc._it=sc.items.map(it=>({l:el('div','abs',esc(it.label),r),s:it.sub?el('div','abs',esc(it.sub),r):null,b:el('div','bar',null,r),v:el('div','val',esc(it.value),r)}));},
  render(sc,u){const n=sc.items.length, step=Math.min(170,520/Math.max(1,n)), y0=650-step*(n-1)/2, max=Math.max(...sc.items.map(i=>+i.amount||0))||1;
    sc._it.forEach((R,i)=>{const it=sc.items[i], a=0.6+i*0.12, o=E.outCubic(P(u,a-0.1,a+0.2)), g=E.outExpo(P(u,a+0.1,a+0.9)), y=y0+i*step, isH=i===(sc.highlight??-1);
      Object.assign(R.l.style,{left:'140px',top:(y-(it.sub?42:26))+'px',width:'600px',fontSize:'42px',fontWeight:620,letterSpacing:'-.03em'}); op(R.l,o);
      if(R.s){Object.assign(R.s.style,{left:'140px',top:(y+10)+'px',fontSize:'26px',color:'var(--mute)',width:'600px'}); op(R.s,o);}
      const bw=Math.max(6,(+it.amount||0)/max*640); Object.assign(R.b.style,{left:'760px',top:(y-28)+'px',height:'56px',width:bw+'px',background:isH?'var(--acc)':'var(--ink)'}); op(R.b,o*(isH?1:.85)); tf(R.b,`scaleX(${g})`);
      Object.assign(R.v.style,{left:(760+bw*g+20)+'px',top:(y-24)+'px',fontSize:'40px',color:isH?'var(--acc)':'var(--ink)'}); op(R.v,o*E.outCubic(P(u,a+0.5,a+0.8)));});}
};

T.flow={
  plan:sc=>{const n=sc.nodes.length, landed=0.6+n*0.12+0.3; return {landed,vis:[['nodes',sc.nodes.reduce((a,s)=>a+words(s),0)+words(sc.note),landed]],fast:[[0.3,landed]]};},
  build(sc,r){sc._n=sc.nodes.map(s=>el('div','node',esc(s),r)); if(sc.note){sc._t=el('div','lbl',esc(sc.note),r); Object.assign(sc._t.style,{left:'0px',width:'1920px',textAlign:'center',top:'800px'});}},
  render(sc,u,D,ex){const n=sc.nodes.length, gap=70, W=Math.min(300,(1640-gap*(n-1))/n), H=150, x0=960-(n*W+(n-1)*gap)/2, y=520, hl=sc.highlight??-1;
    const fs=Math.min(36,W/7);
    sc._n.forEach((d,i)=>{const a=0.5+i*0.12, o=E.outExpo(P(u,a,a+0.5)); Object.assign(d.style,{left:(x0+i*(W+gap))+'px',top:y+'px',width:W+'px',height:H+'px',fontSize:fs+'px',padding:'0 14px',background:i===hl?'var(--acc)':'var(--card)',color:i===hl?'#fff':'var(--ink)',borderColor:i===hl?'var(--acc)':'var(--ink)'}); op(d,o); tf(d,`translateY(${(1-o)*30}px)`);});
    for(let i=0;i<n-1;i++){const a=0.6+i*0.12, e=E.outCubic(P(u,a,a+0.4))*(1-ex); if(e<=0) continue; const xa=x0+i*(W+gap)+W+8, xb=xa+(gap-16)*e, yy=y+H/2;
      fx.strokeStyle=`rgba(${C.ink},${e})`; fx.lineWidth=3; fx.beginPath(); fx.moveTo(xa,yy); fx.lineTo(xb,yy); fx.stroke(); if(e>0.9){fx.fillStyle=C.inkHex; fx.beginPath(); fx.moveTo(xb+2,yy); fx.lineTo(xb-12,yy-8); fx.lineTo(xb-12,yy+8); fx.fill();}}
    const land=0.6+n*0.12+0.3;
    if(u>land){const per=0.35, k=((u-land)/per)%(n+(sc.loop?1:0)); const i=Math.floor(k), f=k-i; let px,py; if(i<n-1){px=L(x0+i*(W+gap)+W/2,x0+(i+1)*(W+gap)+W/2,E.inOutCubic(f)); py=y+H/2;} else {px=x0+(n-1)*(W+gap)+W/2; py=y+H/2;}
      fx.fillStyle=`rgba(${C.acc},${1-ex})`; fx.beginPath(); fx.arc(px,y-26,9,0,7); fx.fill();}
    if(sc.loop){const ar=E.inOutCubic(P(u,land-0.2,land+0.4))*(1-ex); if(ar>0){const xe=x0+(n-1)*(W+gap)+W/2, xs=x0+W/2, yb=y+H+12; fx.strokeStyle=`rgba(${C.acc},${ar})`; fx.lineWidth=3; const p=new Path2D(); p.moveTo(xe,yb); p.bezierCurveTo(xe,yb+120,xs,yb+120,xs,yb+8); fx.save(); fx.setLineDash([3000]); fx.lineDashOffset=3000*(1-ar); fx.stroke(p); fx.restore(); if(ar>0.95){fx.fillStyle=C.accHex; fx.beginPath(); fx.moveTo(xs,yb); fx.lineTo(xs-9,yb+16); fx.lineTo(xs+9,yb+16); fx.fill();}}}
    if(sc._t) op(sc._t,E.outCubic(P(u,land-0.1,land+0.2)));}
};

T.stat={
  plan:sc=>({landed:1.0,vis:[['stat',1+words(sc.label)+words(sc.sub),1.0]]}),
  build(sc,r){sc._v=el('div','abs',null,r); Object.assign(sc._v.style,{top:'380px',width:'1920px',textAlign:'center',fontSize:(sc.size||220)+'px',fontWeight:650,letterSpacing:'-.05em',lineHeight:1,fontVariantNumeric:'tabular-nums'});
    sc._l=el('div','abs',esc(sc.label||''),r); Object.assign(sc._l.style,{top:(400+(sc.size||220)*0.95)+'px',width:'1920px',textAlign:'center',fontSize:'48px',fontWeight:560,letterSpacing:'-.02em'});
    if(sc.sub){sc._s=el('div','abs',esc(sc.sub),r); Object.assign(sc._s.style,{top:(480+(sc.size||220)*0.95)+'px',width:'1920px',textAlign:'center',fontSize:'32px',color:'var(--mute)'});}},
  render(sc,u){const m=String(sc.value).match(/^([^0-9]*)([0-9][0-9,]*\.?[0-9]*)(.*)$/); const x=E.outExpo(P(u,0.1,1.0));
    if(m){const num=parseFloat(m[2].replace(/,/g,'')), dec=(m[2].split('.')[1]||'').length; let v=(num*x).toFixed(dec); if(m[2].includes(',')) v=Number(v).toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec}); sc._v.textContent=m[1]+v+m[3];} else sc._v.textContent=sc.value;
    op(sc._v,clamp(P(u,0.1,0.3))); tf(sc._v,`translateY(${(1-x)*30}px)`); const l=E.outCubic(P(u,0.5,0.85)); op(sc._l,l); tf(sc._l,`translateY(${(1-l)*20}px)`); if(sc._s) op(sc._s,E.outCubic(P(u,0.7,1.0)));}
};

T.end={
  plan:sc=>({noCaption:true,landed:0.95,vis:[['end card',1+words(sc.next),0.95]],noExit:true}),
  build(sc,r){sc._l=el('div','abs mono',esc(sc.kicker||window.SPEC.series||''),r); Object.assign(sc._l.style,{top:'360px',width:'1920px',textAlign:'center',fontSize:'20px',color:'var(--mute)'});
    sc._u=mask(sc.url,'abs',r); Object.assign(sc._u.style,{top:'420px',width:'1920px',textAlign:'center',fontSize:'100px',fontWeight:650,letterSpacing:'-.045em'});
    sc._ul=el('div',null,null,r); Object.assign(sc._ul.style,{position:'absolute',top:'552px',height:'7px',background:'var(--acc)',transformOrigin:'0 50%'});
    if(sc.next){sc._n=el('div','abs',sc.next.replace(/^([^:]*:)(.*)$/,(_,a,b)=>`${esc(a)}<b style="color:var(--ink);font-weight:620">${esc(b)}</b>`),r); Object.assign(sc._n.style,{top:'640px',width:'1920px',textAlign:'center',fontSize:'44px',fontWeight:520,letterSpacing:'-.02em',color:'var(--mute)'});}},
  render(sc,u){op(sc._l,E.outCubic(P(u,0.1,0.4))); const x=E.outExpo(P(u,0.2,0.8)); const w=sc._u.querySelector('.w'); tf(w,`translateY(${(1-x)*110}%)`);
    const uw=w.offsetWidth; sc._ul.style.left=(960-uw/2)+'px'; sc._ul.style.width=uw+'px'; tf(sc._ul,`scaleX(${E.inOutExpo(P(u,0.6,1.2))})`);
    if(sc._n){const n=E.outExpo(P(u,0.45,0.95)); op(sc._n,n); tf(sc._n,`translateY(${(1-n)*24}px)`);}}
};

/* ================= TIMELINE ================= */
let SC=[], TL=null;
function plan(spec){
  let t=0; const rows=[], chap=[], fast=[];
  spec.scenes.forEach((sc,i)=>{
    const ty=T[sc.type]; if(!ty) throw new Error('unknown scene type: '+sc.type);
    const caps=[].concat(sc.caption||[]); const p=ty.plan(sc);
    const blocks=[];
    if(!p.noCaption&&caps[0]) blocks.push([`caption: ${caps[0]}`,words(caps[0]),CAP_IN]);
    if(caps[1]) blocks.push([`caption: ${caps[1]}`,words(caps[1]),(p.cap2??1.7)+0.5]);
    (p.vis||[]).forEach(v=>{if(v[1]>0) blocks.push(v);});
    let D=Math.max(p.min||0,p.landed||0,...blocks.filter(b=>b[3]==null).map(([_,w,a])=>a+need(w)))+(p.noExit?0:EXIT);
    if(sc.hold) D+=sc.hold;
    sc._p=p; sc._caps=caps; sc._start=t; sc._dur=D;
    blocks.forEach(([l,w,a,lv])=>{const leave=lv??(D-(p.noExit?0:EXIT));
      rows.push({scene:i,type:sc.type,label:l,words:w,have:+(leave-a).toFixed(2),need:+need(w).toFixed(2),ok:leave-a>=need(w)-1e-6});});
    fast.push([t-0.05,t+0.75],[t+D-0.35,t+D+0.05]); (p.fast||[]).forEach(([a,b])=>fast.push([t+a,t+b]));
    if(sc.chapter){const ch=[].concat(sc.chapter); if(ch.length>1&&p.split!=null){chap.push([ch[0],t,t+p.split],[ch[1],t+p.split,t+D-OVL]);} else chap.push([ch[0],t,t+D-OVL]);}
    t+=D-(i<spec.scenes.length-1?OVL:0);
  });
  return {duration:+t.toFixed(3),reading:rows,fast,chapters:chap,scenes:spec.scenes.map(s=>({type:s.type,start:+s._start.toFixed(2),dur:+s._dur.toFixed(2)}))};
}

function SETUP(spec){
  window.SPEC=spec; SC=spec.scenes;
  if(spec.theme) Object.entries(spec.theme).forEach(([k,v])=>document.documentElement.style.setProperty('--'+k,v));
  const cs=getComputedStyle(document.documentElement); C.accHex=cs.getPropertyValue('--acc').trim(); C.inkHex=cs.getPropertyValue('--ink').trim(); C.acc=rgb(C.accHex); C.ink=rgb(C.inkHex);
  uc=$('under').getContext('2d'); fx=$('fx').getContext('2d');
  TL=plan(spec);
  $('hdr').textContent=spec.series||''; const b=$('badge'); if(spec.badge){b.querySelector('span').textContent=spec.badge;} else show(b,0);
  const root=$('scenes'); root.innerHTML='';
  WARN.length=0;
  SC.forEach((sc,i)=>{CUR=i; const r=el('div','scene',null,root); sc._root=r;
    // captions are one line each: shrink to fit the 1640px text column, never below 48px
    sc._cap=sc._caps.map((c,j)=>{const d=mask(c,'cap'+(j?' cap2':''),r); d.style.top=(150+j*80)+'px'; const w=d.querySelector('.w').offsetWidth;
      if(w>1640){const f=Math.floor(66*1640/w); d.style.fontSize=Math.max(48,f)+'px'; if(f<48) warn(`caption too long for one line: "${c}"`);} return d;});
    sc._content=el('div','scene',null,r); T[sc.type].build(sc,sc._content);});
  CUR=-1; TL.warnings=WARN.slice();
  const sw=(1640-(TL.chapters.length-1)*20)/Math.max(1,TL.chapters.length);
  $('chap').innerHTML=TL.chapters.map((c,i)=>`<div class="seg" style="left:${i*(sw+20)}px;width:${sw}px"><div class="sl" id="sl${i}">${esc(c[0])}</div><div class="sb"><i id="sf${i}"></i></div></div>`).join('');
  return TL;
}

function render(t){
  uc.clearRect(0,0,1920,1080); fx.clearRect(0,0,1920,1080);
  tf($('dots'),`translate(${-t*6}px,${-t*4}px)`);
  const endSc=SC[SC.length-1], endStart=endSc.type==='end'?endSc._start:TL.duration;
  const firstBody=SC.length>1?SC[1]._start:0;
  const hd=E.outCubic(P(t,0.1,0.6))*(1-P(t,endStart,endStart+0.3)); op($('hdr'),hd);
  const bd=E.outExpo(P(t,firstBody,firstBody+0.5))*(1-P(t,endStart,endStart+0.3)); const b=$('badge'); if(window.SPEC.badge){show(b,bd>0.001); op(b,bd); b.style.left=(1780-b.offsetWidth)+'px';}
  SC.forEach(sc=>{const u=t-sc._start, D=sc._dur, v=u>=-0.01&&u<=D+0.06; show(sc._root,v); if(!v) return;
    sc._cap.forEach((c,i)=>{const a=i===0?0.05:(sc._p.cap2??1.7); const w=c.querySelector('.w'); show(c,u>=a-0.01); roll(w,u,a,D+0.05);});
    const ex=sc._p.noExit?0:E.inCubic(P(u,D-EXIT,D));
    if(sc.type!=='title'&&sc.type!=='statement'){op(sc._content,1-ex); tf(sc._content,`translateY(${-ex*40}px)`);} else {op(sc._content,1);}
    if(sc.type==='statement'){sc._l.forEach(d=>{const o=E.inExpo(P(u,D-EXIT,D+0.05)); tf(d.querySelector('.w'),`translateY(${-o*110}%)`);}); if(sc._s) op(sc._s,1-P(u,D-EXIT,D));}
    T[sc.type].render(sc,u,D,ex);
  });
  // chapter bar
  if(TL.chapters.length){const a0=TL.chapters[0][1]; const cv=E.outCubic(P(t,a0+0.1,a0+0.5))*(1-P(t,endStart-0.1,endStart+0.2)); show($('chap'),cv>0.001); op($('chap'),cv);
    TL.chapters.forEach(([n,a,b],i)=>{tf($('sf'+i),`scaleX(${P(t,a,b)})`); $('sl'+i).style.color=(t>=a&&t<b)?'var(--ink)':(t>=b?'var(--mute)':'var(--faint)');});}
  else show($('chap'),0);
}
window.SETUP=SETUP; window.render=render;
window.FONTS=Promise.all([document.fonts.load('620 66px Disp'),document.fonts.load('500 30px Mono')]).then(()=>document.fonts.ready);
