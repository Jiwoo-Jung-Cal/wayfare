// Illustrated scenes for plan cards, ported verbatim from the design reference
// (design/exports/prototype/r2/index.html, "ART"). The reference covers them with
// photos when present; the photos' licence is not confirmed yet, so the public demo
// shows these illustrations instead. Output is a static SVG string with no user data.
/* eslint-disable */
// @ts-nocheck
export type ArtKey = 'flight' | 'hotel' | 'walk' | 'move' | 'brooklyn';
export const planArt: (k: ArtKey) => string = (() => {let seed=1;const r=()=>(seed=(seed*9301+49297)%233280)/233280;
 const grad=(id,a,b,v=1)=>`<linearGradient id="${id}" x1="0" y1="0" x2="${v?0:1}" y2="${v?1:0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
 const city=(base,minH,maxH,fill,lit,w0=0,w1=600,winc='#FFD98A')=>{let x=w0,s='';while(x<w1){const w=18+r()*38,h=minH+r()*(maxH-minH),t=base-h;s+=`<rect x="${x.toFixed(0)}" y="${t.toFixed(0)}" width="${w.toFixed(0)}" height="${(h+200).toFixed(0)}" fill="${fill}"/>`;
   if(lit)for(let wy=t+8;wy<base-6;wy+=11)for(let wx=x+5;wx<x+w-6;wx+=8)if(r()>lit)s+=`<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="3" height="5" fill="${winc}" opacity="${(.55+r()*.45).toFixed(2)}"/>`;x+=w+(r()>.75?3:0)}return s};
 const S={
  flight:()=>{seed=3;return `<defs>${grad('a','#9CC6EE','#FBE3C6')}${grad('b','#4B5563','#2B313B')}</defs><rect width="600" height="400" fill="url(#a)"/><circle cx="470" cy="250" r="44" fill="#FFE6B0"/><path d="M0 268 Q150 240 300 262 T600 255 V300 H0Z" fill="#B7C9D9"/>
   <rect x="0" y="282" width="600" height="18" fill="#8DA1B4"/>${[40,120,180,260,330,400,470].map(x=>`<rect x="${x}" y="262" width="${40+r()*30|0}" height="${20+r()*14|0}" fill="#7E93A8"/>`).join('')}
   <path d="M0 300 H600 V400 H0Z" fill="#59636F"/><path d="M220 400 L285 300 H315 L380 400Z" fill="url(#b)"/>${[310,330,352,378].map((y,i)=>`<rect x="${298-i}" y="${y}" width="${4+i*2}" height="${8+i*4}" fill="#F4F1E8" opacity=".85"/>`).join('')}
   <path d="M120 230 C220 205 300 170 420 120" stroke="#fff" stroke-width="4" opacity=".7" fill="none" stroke-linecap="round"/>
   <g transform="translate(430 112) rotate(-24)"><path d="M-60 -4 L40 -6 Q58 -6 62 0 Q58 6 40 6 L-60 4 Q-66 0 -60 -4Z" fill="#F7F9FC"/><path d="M-6 -4 L-34 -38 L-22 -38 L18 -4Z" fill="#DCE5EF"/><path d="M-6 4 L-24 30 L-14 30 L14 4Z" fill="#C9D5E3"/><path d="M-58 -3 L-70 -24 L-62 -24 L-46 -3Z" fill="#1F5FA8"/>${[-30,-20,-10,0,10,20].map(x=>`<circle cx="${x}" cy="-1" r="1.6" fill="#4B5563"/>`).join('')}</g>`},
  hotel:()=>{seed=7;return `<defs>${grad('a','#253563','#F0A06E')}</defs><rect width="600" height="400" fill="url(#a)"/>${city(250,60,190,'#2C2F4A',.82)}${city(300,30,120,'#1E2036',.86)}
   <rect x="170" y="120" width="260" height="300" fill="#5B4636"/><rect x="170" y="120" width="260" height="14" fill="#3E2F24"/>${Array.from({length:6},(_,j)=>Array.from({length:5},(_,i)=>`<rect x="${188+i*50}" y="${148+j*34}" width="26" height="20" fill="${r()>.35?'#FFD98A':'#3A3A52'}" opacity=".95"/>`).join('')).join('')}
   <path d="M210 350 h180 l-14 22 h-152Z" fill="#C9402C"/>${[0,1,2,3,4,5,6,7,8].map(i=>`<rect x="${214+i*20}" y="350" width="10" height="22" fill="#F4F1E8" opacity=".55"/>`).join('')}
   <rect x="268" y="372" width="64" height="28" fill="#FFE9B8"/><text x="300" y="112" text-anchor="middle" font-family="Figtree,Arial,sans-serif" font-weight="600" font-size="15" letter-spacing="4" fill="#FFE9B8">HOTEL</text>`},
  walk:()=>{seed=11;return `<defs>${grad('a','#3E6FB0','#F6C79B')}${grad('w','#2F5D8A','#183453')}</defs><rect width="600" height="400" fill="url(#a)"/>${city(268,40,140,'#4E6E96',0)}
   <path d="M330 268 V70 L346 40 L362 70 V268Z" fill="#2E4A6E"/><rect x="345" y="10" width="2" height="34" fill="#2E4A6E"/>${city(282,30,110,'#2B4466',.88,0,600,'#FFE3A3')}
   <rect y="282" width="600" height="80" fill="url(#w)"/>${Array.from({length:14},()=>`<rect x="${r()*560|0}" y="${292+r()*60|0}" width="${20+r()*40|0}" height="2" fill="#FFE3A3" opacity=".45"/>`).join('')}
   <rect y="352" width="600" height="48" fill="#3B3A3A"/><rect y="348" width="600" height="5" fill="#6B6B6B"/>${[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>`<rect x="${i*52}" y="330" width="3" height="20" fill="#6B6B6B"/>`).join('')}<rect y="330" width="600" height="3" fill="#6B6B6B"/>
   ${[[150,0],[176,1],[420,0],[446,1],[468,0]].map(([x,k])=>`<g transform="translate(${x} 306)" fill="#1C1C22"><circle cx="0" cy="0" r="6"/><path d="M-7 8 h14 l3 34 h-6 l-4 -20 l-4 20 h-6Z"/></g>`).join('')}`},
  move:()=>{seed=17;return `<defs>${grad('a','#2A3D6E','#F2A365')}</defs><rect width="600" height="400" fill="url(#a)"/>${city(280,60,170,'#2A2F4D',.8)}<rect y="280" width="600" height="120" fill="#33353F"/><rect y="280" width="600" height="8" fill="#4A4C57"/>
   ${[0,1,2,3,4,5].map(i=>`<rect x="${20+i*110}" y="352" width="56" height="6" fill="#F4F1E8" opacity=".7"/>`).join('')}${[90,330,560].map(x=>`<rect x="${x}" y="190" width="5" height="92" fill="#1D1F2B"/><circle cx="${x+2}" cy="188" r="9" fill="#FFE3A3"/><circle cx="${x+2}" cy="188" r="26" fill="#FFE3A3" opacity=".18"/>`).join('')}
   <g transform="translate(170 266)"><path d="M10 40 Q12 20 40 16 L80 2 Q96 -2 150 0 Q178 2 196 18 L228 24 Q246 28 248 44 V58 H8Z" fill="#F4C21B"/><path d="M86 8 L140 6 Q164 8 180 20 H74Z" fill="#9CC6EE"/><rect x="118" y="6" width="5" height="16" fill="#F4C21B"/><rect x="104" y="-12" width="44" height="12" rx="3" fill="#FDF3D1"/><text x="126" y="-3" text-anchor="middle" font-family="Figtree,Arial,sans-serif" font-weight="600" font-size="9" fill="#222">TAXI</text>
   <rect x="8" y="40" width="240" height="6" fill="#1D1F2B" opacity=".25"/><circle cx="60" cy="60" r="18" fill="#1D1F2B"/><circle cx="60" cy="60" r="8" fill="#9AA3AE"/><circle cx="200" cy="60" r="18" fill="#1D1F2B"/><circle cx="200" cy="60" r="8" fill="#9AA3AE"/><rect x="236" y="30" width="12" height="8" rx="2" fill="#FFF3C4"/></g>`},
  brooklyn:()=>{seed=23;const tower=x=>`<g fill="#7A5A48"><rect x="${x}" y="110" width="56" height="210"/><rect x="${x+6}" y="150" width="17" height="70" rx="8" fill="url(#a)"/><rect x="${x+33}" y="150" width="17" height="70" rx="8" fill="url(#a)"/><rect x="${x-4}" y="104" width="64" height="10"/></g>`;
   return `<defs>${grad('a','#8EC1E8','#F9D8B8')}${grad('w','#4F86B5','#244E77')}</defs><rect width="600" height="400" fill="url(#a)"/>${city(300,30,130,'#9DB3C8',0)}<rect y="300" width="600" height="100" fill="url(#w)"/>
   ${tower(120)}${tower(420)}<rect x="0" y="230" width="600" height="12" fill="#5A4134"/>
   <g stroke="#3D2F27" stroke-width="1.6" fill="none" opacity=".9"><path d="M-20 120 Q74 238 148 112"/><path d="M148 112 Q300 260 448 112"/><path d="M448 112 Q530 238 620 120"/>${Array.from({length:22},(_,i)=>{const x=160+i*12.5,y=112+ (1-Math.pow((x-298)/150,2))*0+((x-298)**2)/(150**2)*-1;return ''}).join('')}</g>
   <g stroke="#3D2F27" stroke-width="1" opacity=".6">${Array.from({length:23},(_,i)=>{const x=156+i*12.5,t=(x-148)/300,y=112+4*148*t*(1-t)*.95;return `<line x1="${x}" y1="${y.toFixed(1)}" x2="${x}" y2="230"/>`}).join('')}</g>
   ${Array.from({length:12},()=>`<rect x="${r()*560|0}" y="${310+r()*80|0}" width="${20+r()*40|0}" height="2" fill="#fff" opacity=".35"/>`).join('')}`}};
 return k=>`<svg class="wf-art" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${S[k]()}</svg>`})();
