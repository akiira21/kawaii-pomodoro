// GPU effects for the pixel backgrounds.
//
// The canvas is 320x180 (one fragment == one "art pixel"), and every effect snaps to that
// grid, so the result still looks like hand-made pixel art - it just moves like a game.
//
// Techniques used (the same ones you'd use in a game engine, but evaluated per-pixel):
//   * Emitter particles   - N particles with seed/lifetime/age, respawned every cycle (petals).
//   * Scrolling cell grids - an endless, pop-free particle field (pollen, drifting petals).
//   * Lissajous wanderers - fireflies, butterflies, birds.
//   * Global wind         - one gust function drives grass, trees, petals, streaks and mist,
//                           so everything surges together like real wind.
//   * Vertex-style warps  - the "sway" texture layer is displaced per row to bend foliage.
//   * Ordered dithering   - 4x4 Bayer matrix for gradients, glows and fades (retro look).
export const W = 320, H = 180;

// '#ffc2dc' -> 'vec3(1.0000,0.7608,0.8627)' so shader code can be written with hex colors.
const c3 = (hex) => {
  const n = parseInt(hex.slice(1), 16), f = (v) => (v / 255).toFixed(4);
  return `vec3(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

const HEAD = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float u_t;          // seconds
uniform sampler2D u_back;   // static scenery
uniform sampler2D u_sway;   // foliage that bends in the wind
const float W = 320.0;
const float H = 180.0;
`;

const COMMON = `
// ---------- hashing / noise ----------
float h11(float n){ return fract(sin(n*127.1+311.7)*43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x), mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x), f.y);
}
// Same ground profile as the CPU scenery, so blades/flowers stand exactly on it.
float ridge(float i,float b,float a,float f,float p){ return b+sin((i+p)*f)*a+sin((i+p)*f*2.3)*a*0.4; }

// ---------- 4x4 ordered dithering (classic Bayer matrix) ----------
float bayer(vec2 p){
  vec2 q=mod(floor(p),4.0);
  float x0=mod(q.x,2.0), x1=floor(q.x*0.5), y0=mod(q.y,2.0), y1=floor(q.y*0.5);
  float v=8.0*abs(x0-y0)+4.0*y0+2.0*abs(x1-y1)+y1;
  return (v+0.5)/16.0;
}

// ---------- pixel helpers (p is always an integer pixel, y grows downwards) ----------
float rect(vec2 p,vec2 o,vec2 s){ vec2 d=p-o; return step(0.0,d.x)*step(0.0,d.y)*step(d.x,s.x-1.0)*step(d.y,s.y-1.0); }
float px(vec2 d,float x,float y){ vec2 e=abs(d-vec2(x,y)); return step(e.x+e.y,0.1); }
vec4 tex(sampler2D s,vec2 p){
  if(p.x<0.0||p.x>=W||p.y<0.0||p.y>=H) return vec4(0.0);
  return texture2D(s,(p+0.5)/vec2(W,H));
}

// ---------- global wind ----------
// Gust that travels left->right across the screen (so grass bends in a rolling wave).
float windAt(float x,float t){
  return clamp(0.55+0.30*sin(t*0.8-x*0.022)+0.18*sin(t*0.33-x*0.009+1.7),0.05,1.3);
}
// Global wind speed (for particles) and its integral (their travelled distance).
float gustSpeed(float t){ return 0.95+0.5*sin(t*0.6)+0.25*sin(t*0.23+1.0); }
float gustInt(float t){ return 0.95*t-(0.5/0.6)*cos(t*0.6)-(0.25/0.23)*cos(t*0.23+1.0); }

// ---------- palettes / gradients ----------
vec3 pick6(float i,vec3 a,vec3 b,vec3 c,vec3 d,vec3 e,vec3 f){
  vec3 r=a; r=mix(r,b,step(0.5,i)); r=mix(r,c,step(1.5,i)); r=mix(r,d,step(2.5,i)); r=mix(r,e,step(3.5,i)); r=mix(r,f,step(4.5,i)); return r;
}
// Six colour bands from y0 to y1, blended between bands with a dither (no smooth gradients in pixel art).
vec3 sky6(vec2 p,float y0,float y1,vec3 c0,vec3 c1,vec3 c2,vec3 c3,vec3 c4,vec3 c5){
  float g=clamp((p.y-y0)/(y1-y0),0.0,0.9999)*6.0;
  float i=floor(g), fr=fract(g);
  float up=step(bayer(p),clamp((fr-0.5)*2.0,0.0,1.0));
  return mix(pick6(i,c0,c1,c2,c3,c4,c5),pick6(min(i+1.0,5.0),c0,c1,c2,c3,c4,c5),up);
}

// ---------- sky pieces ----------
// Pixel clouds drifting with the sky.
vec3 clouds(vec3 col,vec2 p,float t,float n,vec3 bodyC,vec3 underC){
  for(int i=0;i<6;i++){
    float fi=float(i); if(fi>=n) break;
    float w=20.0+mod(fi,3.0)*8.0;
    float sp=(0.05+mod(fi,3.0)*0.03)*60.0;
    float x=floor(mod(fi*(W/n)+sp*t,W+60.0))-40.0;
    float y=10.0+mod(fi*29.0,50.0);
    float body=max(max(rect(p,vec2(x,y+6.0),vec2(w,6.0)),rect(p,vec2(x+4.0,y+2.0),vec2(w-10.0,5.0))),rect(p,vec2(x+8.0,y-1.0),vec2(10.0,4.0)));
    float under=rect(p,vec2(x,y+11.0),vec2(w,2.0));
    col=mix(col,bodyC,body);
    col=mix(col,underC,under);
  }
  return col;
}
// Sun / moon with a pulsing dithered halo and slowly turning rays.
vec3 sun(vec3 col,vec2 p,vec2 c,float r,vec3 core,vec3 inner,vec3 glow,float t,float rays){
  vec2 q=p+0.5-c;
  float d=length(q);
  float pulse=0.5+0.5*sin(t*0.9);
  float a=clamp(1.0-(d-r)/(24.0+6.0*pulse),0.0,1.0);
  float halo=step(bayer(p),a*a*0.95)*step(r,d);
  float ang=atan(q.y,q.x);
  float ray=0.5+0.5*sin(ang*9.0+t*0.22+sin(t*0.11)*2.0);
  float ro=step(bayer(p+vec2(1.0,2.0)),ray*ray*clamp(1.0-(d-r)/95.0,0.0,1.0)*0.6)*step(r,d)*rays;
  col=mix(col,glow,halo*0.55);
  col=mix(col,glow,ro*0.28);
  col=mix(col,core,step(d,r));
  col=mix(col,inner,step(d,r*0.72));
  return col;
}

// ---------- wind streaks: wavy dashes that follow the gusts ----------
vec4 windStreaks(vec2 p,float t,float act,vec3 tailC,vec3 headC){
  for(int k=-1;k<=1;k++){
    float lane=floor(p.y/6.0)+float(k);
    float hh=h11(lane*5.17+3.0);
    if(hh>act) continue;
    for(int j=0;j<2;j++){
      float fj=float(j);
      float len=12.0+h11(lane*1.9+fj*7.0)*28.0;
      float spd=0.8+0.5*h11(lane*3.3+fj*2.0);
      float per=W+110.0;
      float x=mod(h11(lane*2.7+fj*5.0)*per+gustInt(t)*38.0*spd,per)-55.0;
      float dx=x-p.x;
      if(dx<0.0||dx>len) continue;
      float wob=sin(p.x*0.11+t*2.0+hh*20.0)*1.4+sin(p.x*0.047-t*0.9+hh*9.0)*1.8;
      float yy=floor(lane*6.0+3.0+(h11(lane+31.0+fj)-0.5)*2.0+wob+0.5);
      if(abs(p.y-yy)>0.5) continue;
      float fade=1.0-dx/len;
      if(fade<bayer(p)*0.85) continue;
      return vec4(dx<2.5?headC:tailC,0.9);
    }
  }
  return vec4(0.0);
}

// ---------- grass: 1px blades that bend with the travelling gust ----------
// Ground at column x is ridge(x,rb,ra,rf,rp)+yo, or the screen bottom when flatB>0.5.
vec4 grassLayer(vec2 p,float t,float amp,float rb,float ra,float rf,float rp,float yo,float hmin,float hr,float stp,float flatB,vec3 c0,vec3 c1,vec3 c2){
  for(int k=-3;k<=3;k++){
    float xb=p.x-float(k);
    if(mod(xb,stp)>0.5) continue;
    float gy=flatB>0.5?H:floor(ridge(xb,rb,ra,rf,rp)+yo+0.5);
    float hg=hmin+floor(h11(xb)*hr);
    float above=gy-p.y;
    if(above<-1.0||above>hg) continue;
    float u=clamp(above/hg,0.0,1.0);
    float w=windAt(xb,t);
    float lean=(w*2.6+sin(t*2.6+xb*0.31+h11(xb+5.0)*6.0)*0.9*w)*u*u*amp;
    if(floor(lean+0.5)!=float(k)) continue;
    float ci=h11(xb+9.0);
    vec3 c=ci<0.34?c0:(ci<0.67?c1:c2);
    c=mix(c,vec3(1.0),step(hg-1.0,above)*0.22);   // lit tip
    return vec4(c,1.0);
  }
  return vec4(0.0);
}

// ---------- foliage bending ----------
// Samples the sway layer shifted sideways by the wind. hf = 0 at the roots, 1 at the tips.
vec4 swaySample(vec2 p,float t,float hf,float amp){
  float w=windAt(p.x,t);
  float s=(w*1.2+sin(t*1.4+p.y*0.09+p.x*0.03)*w*0.9)*amp*hf;
  return tex(u_sway,p-vec2(floor(s+0.5),0.0));
}

// ---------- scrolling cell field: endless pop-free particles ----------
// style 0: tumbling petal (2x2)   style 1: twinkling pollen sparkle
vec4 motes(vec2 p,float t,float cs,vec2 vel,float dens,float style,float seed){
  const float N=48.0;
  vec2 drift=vec2(vel.x*gustInt(t),vel.y*t);
  drift=mod(drift,cs*N);
  vec2 q=p-drift;
  vec2 cell=floor(q/cs);
  for(int j=-1;j<=1;j++){
    for(int i=-1;i<=1;i++){
      vec2 c=cell+vec2(float(i),float(j));
      vec2 cm=mod(c,N);
      float hh=h21(cm+seed);
      if(hh>dens) continue;
      vec2 o=vec2(h21(cm+seed+1.1),h21(cm+seed+2.2));
      vec2 pos=(c+o)*cs+drift;
      float ph=h21(cm+seed+3.3)*6.283;
      pos+=vec2(sin(t*1.3+ph)*4.0,cos(t*1.7+ph*1.3)*3.0);
      vec2 d=p-floor(pos);
      if(style<0.5){
        if(d.x<0.0||d.x>2.0||d.y<0.0||d.y>2.0) continue;
        float fl=mod(floor(t*3.0+ph),2.0);
        float m=rect(d,vec2(0.0),mix(vec2(2.0,2.0),vec2(2.0,1.0),fl));
        if(m<0.5) continue;
        return vec4(mix(vec3(1.0,0.76,0.86),vec3(1.0),step(0.5,px(d,0.0,0.0)+fl)*0.6),1.0);
      } else {
        float tw=0.5+0.5*sin(t*(2.0+hh*3.0)+ph);
        float core=px(d,0.0,0.0)*step(0.25,tw);
        float cross=step(0.88,tw)*(px(d,1.0,0.0)+px(d,-1.0,0.0)+px(d,0.0,1.0)+px(d,0.0,-1.0));
        if(core+cross<0.5) continue;
        return vec4(mix(vec3(1.0,0.93,0.55),vec3(1.0),step(0.88,tw)),0.95);
      }
    }
  }
  return vec4(0.0);
}
`;

const MAIN = `
void main(){
  vec2 fc=floor(gl_FragCoord.xy);
  vec2 p=vec2(fc.x,H-1.0-fc.y);     // top-left origin, integer pixel
  gl_FragColor=vec4(scene(p),1.0);
}
`;

// ============================================================================================
// SAKURA - wind through a cherry tree: canopy ripples, petals are emitted from it and blown
// across the screen, tumble, land in the grass and skate away.
// ============================================================================================
const SAKURA = () => `
float petalShape(vec2 d,float f,float big){
  float r=0.0;
  if(big<0.5){
    if(f<0.5){ r=rect(d,vec2(0.0),vec2(3.0,2.0)); if(r>0.5){ r=1.0; if(px(d,0.0,0.0)+px(d,1.0,0.0)>0.5) r=2.0; if(px(d,2.0,1.0)>0.5) r=3.0; } }
    else if(f<1.5){ r=rect(d,vec2(0.0),vec2(2.0,3.0)); if(r>0.5){ r=1.0; if(px(d,0.0,0.0)>0.5) r=2.0; if(px(d,1.0,2.0)>0.5) r=3.0; } }
    else { r=rect(d,vec2(0.0),vec2(3.0,1.0)); if(r>0.5){ r=1.0; if(px(d,0.0,0.0)>0.5) r=2.0; if(px(d,2.0,0.0)>0.5) r=3.0; } }
  } else {
    if(f<0.5){ r=rect(d,vec2(0.0),vec2(4.0,3.0))*(1.0-px(d,0.0,2.0))*(1.0-px(d,3.0,0.0)); if(r>0.5){ r=1.0; if(px(d,1.0,0.0)+px(d,0.0,1.0)>0.5) r=2.0; if(px(d,3.0,1.0)+px(d,2.0,2.0)>0.5) r=3.0; } }
    else if(f<1.5){ r=rect(d,vec2(0.0),vec2(3.0,4.0))*(1.0-px(d,0.0,3.0))*(1.0-px(d,2.0,0.0)); if(r>0.5){ r=1.0; if(px(d,1.0,0.0)+px(d,0.0,1.0)>0.5) r=2.0; if(px(d,2.0,2.0)+px(d,1.0,3.0)>0.5) r=3.0; } }
    else { r=rect(d,vec2(0.0),vec2(4.0,2.0))*(1.0-px(d,0.0,1.0))*(1.0-px(d,3.0,0.0)); if(r>0.5){ r=1.0; if(px(d,1.0,0.0)>0.5) r=2.0; if(px(d,3.0,1.0)>0.5) r=3.0; } }
  }
  return r;
}
vec3 petalCol(float i){
  vec3 c=${c3('#ffc2dc')};
  c=mix(c,${c3('#ffd6e8')},step(0.5,i)); c=mix(c,${c3('#ff9fc6')},step(1.5,i)); c=mix(c,${c3('#ffb3d1')},step(2.5,i));
  return c;
}
// Emitter particle system. Each of the 46 particles lives 12-21 s, then is respawned
// (new random seed) either inside the canopy or at the left edge. x follows the global wind.
void petals(vec2 p,float t,inout vec4 behind,inout vec4 front){
  float gi=gustInt(t);
  for(int i=0;i<60;i++){
    float fi=float(i);
    float life=12.0+h11(fi*3.1+0.5)*9.0;
    float ph=t/life+h11(fi*7.7+1.3);
    float cyc=floor(ph), age=fract(ph);
    float sd=fi*13.37+cyc*71.3;
    float cls=h11(sd+9.0);
    float big=step(0.80,cls);
    float far=1.0-step(0.22,cls);
    float a=smoothstep(0.0,0.05,age)*(1.0-smoothstep(0.80,1.0,age));
    if(a<bayer(p)) continue;
    vec2 st; float vx;
    if(h11(sd+1.0)<0.62){
      float an=h11(sd+2.0)*6.2832, dd=sqrt(h11(sd+3.0));
      st=vec2(92.0+cos(an)*dd*68.0,62.0+sin(an)*dd*36.0); vx=15.0+13.0*h11(sd+5.0);
    } else {
      st=vec2(-8.0,6.0+h11(sd+4.0)*135.0); vx=26.0+16.0*h11(sd+5.0);
    }
    float el=age*life;
    float vy=(5.0+8.0*h11(sd+6.0))*(1.0+big*0.3-far*0.3);
    float x=st.x+vx*(1.0+big*0.4)*(gi-gustInt(t-el));
    float yRaw=st.y+vy*el;
    float gy=158.0+h11(sd+8.0)*18.0;
    float landed=step(gy,yRaw);
    float y=mix(yRaw+sin(t*1.9+sd)*3.0+sin(t*0.8+sd*2.0)*2.0,gy,landed);
    x+=sin(t*1.3+sd*1.7)*3.0*(1.0-landed);
    vec2 d=p-floor(vec2(x,y));
    if(d.x<-1.0||d.x>4.0||d.y<-1.0||d.y>4.0) continue;
    float fs=mod(floor(t*(4.0+h11(sd+10.0)*3.0)+h11(sd+11.0)*4.0),4.0);
    float f=fs>2.5?1.0:fs;
    float s=far>0.5?rect(d,vec2(0.0),vec2(2.0,1.0)):petalShape(d,f,big);
    if(s<0.5) continue;
    vec3 base=petalCol(floor(h11(sd+12.0)*4.0));
    vec3 pc=s>2.5?base*0.86:(s>1.5?mix(base,vec3(1.0),0.55):base);
    vec4 o=vec4(pc,far>0.5?0.7:1.0);
    if(big>0.5) front=o; else behind=o;
  }
}

vec3 scene(vec2 p){
  float t=u_t;
  float wind=windAt(p.x,t);
  vec3 col=sky6(p,0.0,180.0,${c3('#ffd9ec')},${c3('#ffe3f1')},${c3('#ffeef6')},${c3('#fff5ef')},${c3('#eaf7ff')},${c3('#d6f0ff')});
  col=sun(col,p,vec2(255.0,40.0),10.0,${c3('#fff6dc')},${c3('#fffbe8')},${c3('#fff0c8')},t,1.0);
  col=clouds(col,p,t,4.0,vec3(1.0),${c3('#ffd0e4')});
  vec4 b=tex(u_back,p); col=mix(col,b.rgb,b.a);

  // canopy: bends in the wind, glints when a gust sweeps through it
  vec4 cn=swaySample(p,t,clamp((125.0-p.y)/60.0,0.25,1.0),1.6);
  float glint=step(0.965,h21(floor(p*0.5)+floor(t*2.5)))+step(0.93,sin(p.x*0.05-t*1.7+p.y*0.02))*step(0.55,h21(p+floor(t*4.0)));
  col=mix(col,cn.rgb,cn.a);
  col=mix(col,${c3('#fff7fb')},cn.a*clamp(glint,0.0,1.0)*0.85);

  vec4 ws=windStreaks(p,t,0.62,${c3('#f7b5d2')},${c3('#fff7fb')}); col=mix(col,ws.rgb,ws.a);
  vec4 g1=grassLayer(p,t,1.4,152.0,3.0,0.03,0.0,3.0,3.0,5.0,2.0,0.0,${c3('#7fd49c')},${c3('#5cc183')},${c3('#a6e8b8')}); col=mix(col,g1.rgb,g1.a);
  vec4 pb=vec4(0.0), pf=vec4(0.0);
  petals(p,t,pb,pf);
  col=mix(col,pb.rgb,pb.a);
  vec4 g2=grassLayer(p,t,1.8,0.0,0.0,0.0,0.0,0.0,5.0,6.0,3.0,1.0,${c3('#5cc183')},${c3('#4aa872')},${c3('#7fd49c')}); col=mix(col,g2.rgb,g2.a);
  col=mix(col,pf.rgb,pf.a);       // big near petals pass in front of everything
  return col;
}
`;

// ============================================================================================
// MEADOW - rolling gust waves through grass and flowers, pines sway, butterflies, pollen.
// ============================================================================================
const MEADOW = () => `
// Flowers on swaying stems. One flower per column slot; head leans with the gust.
vec4 flowerRow(vec2 p,float t,float sp,float off,float rb,float ra,float rf,float rph,float yo,float yv,float smin,float svar,float big){
  float n=floor((p.x-off)/sp+0.5);
  float xf=off+n*sp;
  float hh=h11(n*3.7+sp);
  float gy=floor(ridge(xf,rb,ra,rf,rph)+yo+floor(h11(n*1.3+sp+2.0)*yv/3.0)*3.0+0.5);
  float stem=smin+floor(hh*svar);
  float above=gy-p.y;
  if(above<-0.5||above>stem+3.0) return vec4(0.0);
  float w=windAt(xf,t);
  float lean=w*2.0+sin(t*2.2+n*1.7)*0.9*w;
  float u=clamp(above/stem,0.0,1.0);
  float so=floor(lean*u*u+0.5);
  float ho=floor(lean+0.5);
  vec2 d=p-vec2(xf+ho,gy-stem-1.0);
  float ci=floor(h11(n*2.1+sp)*4.0);
  vec3 pc=${c3('#ff8fb8')};
  pc=mix(pc,vec3(1.0),step(0.5,ci)); pc=mix(pc,${c3('#ffe08a')},step(1.5,ci)); pc=mix(pc,${c3('#d9b8ff')},step(2.5,ci));
  if(big>0.5){
    float daisy=step(0.5,h11(n*5.3+sp));
    float ring=step(abs(d.x),1.0)*step(abs(d.y),1.0)*(daisy+(1.0-daisy)*(px(d,0.0,0.0)+px(d,1.0,0.0)+px(d,-1.0,0.0)+px(d,0.0,1.0)+px(d,0.0,-1.0)));
    if(ring>0.5) return vec4(px(d,0.0,0.0)>0.5?${c3('#ffe08a')}:pc,1.0);
  } else {
    if(px(d,0.0,0.0)+px(d,1.0,0.0)>0.5) return vec4(pc,1.0);
  }
  if(abs(p.x-(xf+so))<0.5&&above>=0.0&&above<=stem) return vec4(${c3('#3a9a62')},1.0);
  if(big>0.5&&above>2.0&&above<4.0&&abs(p.x-(xf+so+(hh>0.5?1.0:-1.0)))<0.5) return vec4(${c3('#4fb877')},1.0);
  return vec4(0.0);
}
// Butterflies: slow lissajous flight + fast wing flap.
vec3 butterflies(vec3 col,vec2 p,float t){
  for(int i=0;i<3;i++){
    float fi=float(i);
    float sp=0.16+0.05*fi;
    vec2 c=vec2(70.0+fi*85.0+58.0*sin(t*sp+fi*2.0),112.0+fi*13.0+22.0*sin(t*sp*1.7+fi*4.0));
    c+=vec2(sin(t*0.9+fi)*3.0,sin(t*7.0+fi)*1.4);
    vec2 d=p-floor(c);
    if(abs(d.x)>3.0||abs(d.y)>2.0) continue;
    float open=step(0.0,sin(t*14.0+fi*3.0));
    float wing=step(1.0,abs(d.x))*step(abs(d.x),mix(1.0,2.0,open))*step(abs(d.y-0.0),1.0)*step(d.y,0.0)*(1.0-step(2.0,abs(d.x))*step(-0.5,d.y));
    float body=px(d,0.0,-1.0)+px(d,0.0,0.0)+px(d,0.0,1.0);
    vec3 wc=fi<0.5?${c3('#ff8fb8')}:(fi<1.5?${c3('#ffe08a')}:${c3('#c9a8ff')});
    wc=mix(wc,vec3(1.0),step(1.0,abs(d.x))*step(d.y,-0.5)*0.5);
    col=mix(col,wc,clamp(wing,0.0,1.0));
    col=mix(col,${c3('#4a3a5c')},clamp(body,0.0,1.0));
  }
  return col;
}

vec3 scene(vec2 p){
  float t=u_t;
  float wind=windAt(p.x,t);
  vec3 col=sky6(p,0.0,180.0,${c3('#8fd3ff')},${c3('#a9ddff')},${c3('#c6ebff')},${c3('#e4f4ff')},${c3('#fff0f0')},${c3('#ffdcec')});
  col=sun(col,p,vec2(262.0,36.0),9.0,${c3('#fff3c4')},${c3('#fff8da')},${c3('#fff6c8')},t,1.0);
  col=clouds(col,p,t,6.0,vec3(1.0),${c3('#ffd9ec')});
  vec4 b=tex(u_back,p); col=mix(col,b.rgb,b.a);

  float tb=ridge(p.x,140.0,8.0,0.04,10.0)+2.0;
  vec4 tr=swaySample(p,t,clamp((tb-p.y)/18.0,0.0,1.0),1.3);
  col=mix(col,tr.rgb,tr.a);

  vec4 ws=windStreaks(p,t,0.55,${c3('#a7ddf5')},${c3('#eef9ff')}); col=mix(col,ws.rgb,ws.a);
  vec4 g1=grassLayer(p,t,1.0,160.0,5.0,0.06,40.0,3.0,3.0,4.0,2.0,0.0,${c3('#4fb877')},${c3('#3a9a62')},${c3('#7fd49c')}); col=mix(col,g1.rgb,g1.a);
  vec4 f1=flowerRow(p,t,7.0,3.0,140.0,8.0,0.04,10.0,9.0,9.0,3.0,2.0,0.0); col=mix(col,f1.rgb,f1.a);
  vec4 f2=flowerRow(p,t,9.0,3.0,160.0,5.0,0.06,40.0,7.0,9.0,5.0,5.0,1.0); col=mix(col,f2.rgb,f2.a);
  col=butterflies(col,p,t);
  vec4 pol=motes(p,t,30.0,vec2(5.0,-3.0),0.5,1.0,40.0); col=mix(col,pol.rgb,pol.a);
  vec4 pet=motes(p,t,40.0,vec2(14.0,5.0),0.55,0.0,10.0); col=mix(col,pet.rgb,pet.a);
  vec4 g2=grassLayer(p,t,1.5,0.0,0.0,0.0,0.0,0.0,5.0,6.0,3.0,1.0,${c3('#4fb877')},${c3('#3a9a62')},${c3('#7fd49c')}); col=mix(col,g2.rgb,g2.a);
  return col;
}
`;

// ============================================================================================
// NIGHT - cool breeze: drifting mist, swaying pines and grass, fireflies with glowing trails,
// twinkling stars, a faint aurora and the odd shooting star.
// ============================================================================================
const NIGHT = () => `
// Fireflies wander on layered sine paths; the breeze nudges them sideways.
vec2 ffPos(float fi,float t){
  float a=h11(fi+11.0)*6.283, b=h11(fi+23.0)*6.283;
  vec2 home=vec2(h11(fi+200.0)*W,108.0+h11(fi+300.0)*64.0);
  vec2 w=vec2(sin(t*(0.30+0.25*h11(fi+5.0))+a)*16.0+sin(t*0.83+b)*5.0,
              cos(t*(0.25+0.20*h11(fi+6.0))+b)*9.0+sin(t*0.61+a)*3.0);
  return home+w+vec2((windAt(home.x,t)-0.6)*14.0,0.0);
}
vec3 fireflies(vec3 col,vec2 p,float t){
  if(p.y<70.0) return col;
  for(int i=0;i<28;i++){
    float fi=float(i);
    float pulse=pow(max(sin(t*(1.1+h11(fi+7.0)*1.5)+h11(fi+9.0)*6.283),0.0),1.5);
    vec2 c=floor(ffPos(fi,t));
    vec2 d=p-c;
    if(abs(d.x)>9.0||abs(d.y)>9.0) continue;
    float dist=length(p-c-0.5);
    float haloR=2.0+6.5*pulse;
    float a=clamp(1.0-dist/haloR,0.0,1.0);
    col+=${c3('#ffd84a')}*step(bayer(p),a*a*0.9)*0.38;
    float core=rect(d,vec2(0.0),vec2(2.0,2.0))*step(0.45,pulse)+px(d,0.0,0.0)*step(0.12,pulse);
    col=mix(col,mix(${c3('#ffe66d')},vec3(1.0,0.97,0.8),step(0.85,pulse)),clamp(core,0.0,1.0));
    vec2 t1=floor(ffPos(fi,t-0.10)), t2=floor(ffPos(fi,t-0.22));
    float tr=(px(p-t1,0.0,0.0)*0.55+px(p-t2,0.0,0.0)*0.3)*pulse;
    if(tr>0.0 && bayer(p)<tr) col=mix(col,${c3('#b89a3c')},0.9);
  }
  return col;
}
// Low mist rolling in on the breeze.
float mist(vec2 p,float t,float y0,float y1,float scale,float speed,float seed){
  float band=smoothstep(y0,y0+12.0,p.y)*(1.0-smoothstep(y1-12.0,y1,p.y));
  float x=p.x*scale-gustInt(t)*speed+seed;
  float n=vn(vec2(x,p.y*0.08+seed))*0.65+vn(vec2(x*2.3+7.0,p.y*0.19+3.0))*0.35;
  return smoothstep(0.45,0.8,n)*band;
}
vec3 stars(vec3 col,vec2 p,float t){
  float cs=11.0;
  vec2 cell=floor(p/cs);
  float pres=step(0.42,h21(cell+3.3));
  vec2 pos=floor(cell*cs+vec2(h21(cell+1.1),h21(cell+2.2))*(cs-3.0))+1.0;
  vec2 d=p-pos;
  float tw=sin(t*(1.2+h21(cell)*2.2)+h21(cell+9.0)*6.283);
  float big=step(0.86,h21(cell+5.0));
  float on=px(d,0.0,0.0)*step(-0.55,tw)*pres;
  float cr=big*pres*step(0.6,tw)*(px(d,1.0,0.0)+px(d,-1.0,0.0)+px(d,0.0,1.0)+px(d,0.0,-1.0));
  col=mix(col,${c3('#fff6c8')},clamp(on,0.0,1.0));
  col=mix(col,${c3('#d9d2ff')},clamp(cr,0.0,1.0));
  return col;
}
vec3 aurora(vec3 col,vec2 p,float t){
  float y0=46.0+13.0*sin(p.x*0.02+t*0.16)+7.0*sin(p.x*0.05-t*0.21);
  float dy=(p.y-y0)/20.0;
  float a=exp(-dy*dy*1.4)*(0.7+0.3*sin(p.x*0.15+t*0.7+sin(p.x*0.06)*3.0))*smoothstep(0.0,40.0,p.y);
  float hueMix=0.5+0.5*sin(p.x*0.012-t*0.1);
  vec3 ac=mix(${c3('#5fe0b0')},${c3('#a98cff')},hueMix);
  return mix(col,ac,step(bayer(p),a*0.30)*0.40);
}

vec3 scene(vec2 p){
  float t=u_t;
  vec3 col=sky6(p,0.0,180.0,${c3('#1b1442')},${c3('#2a1f5e')},${c3('#3b2a7a')},${c3('#52388f')},${c3('#6e4a9e')},${c3('#8d5fa8')});
  col=aurora(col,p,t);
  col=stars(col,p,t);
  col=sun(col,p,vec2(255.0,42.0),12.0,${c3('#fff3c4')},${c3('#fff6d2')},${c3('#b9a4f0')},t,0.0);
  float dsk=step(length(p+0.5-vec2(255.0,42.0)),12.0);
  col=mix(col,${c3('#f0dc9c')},dsk*clamp(rect(p,vec2(250.0,38.0),vec2(3.0,3.0))+rect(p,vec2(258.0,47.0),vec2(4.0,3.0)),0.0,1.0));

  // shooting star every 7 seconds
  float cy=floor(t/7.0), k=mod(t,7.0);
  if(k<0.9){
    vec2 s0=vec2(240.0+h11(cy)*90.0,4.0+h11(cy+9.0)*30.0);
    vec2 v=vec2(-300.0-120.0*h11(cy+3.0),140.0+70.0*h11(cy+5.0));
    vec2 hd=s0+v*k, tl=s0+v*max(k-0.28,0.0);
    vec2 ab=hd-tl; float ln=max(dot(ab,ab),0.001);
    float w=clamp(dot(p+0.5-tl,ab)/ln,0.0,1.0);
    float dist=length(p+0.5-(tl+ab*w));
    float fadeIO=smoothstep(0.0,0.08,k)*(1.0-smoothstep(0.7,0.9,k));
    if(dist<0.75&&w*fadeIO>bayer(p)*0.9) col=mix(${c3('#c8b8ff')},vec3(1.0),step(0.85,w));
  }

  vec4 b=tex(u_back,p); col=mix(col,b.rgb,b.a);
  float m1=mist(p,t,112.0,150.0,0.030,0.35,2.0);
  col=mix(col,${c3('#6c5aa8')},step(bayer(p),m1*0.75)*0.42);

  float tb=ridge(p.x,128.0,10.0,0.03,20.0)+4.0;
  vec4 tr=swaySample(p,t,clamp((tb-p.y)/22.0,0.0,1.0),1.1);
  col=mix(col,tr.rgb,tr.a);

  vec4 ws=windStreaks(p,t,0.5,${c3('#594a91')},${c3('#b5a8dc')}); col=mix(col,ws.rgb,ws.a*0.9);
  vec4 g1=grassLayer(p,t,1.1,150.0,4.0,0.04,20.0,3.0,3.0,5.0,2.0,0.0,${c3('#2f6a6a')},${c3('#3b8a78')},${c3('#5fb59a')}); col=mix(col,g1.rgb,g1.a);
  col=fireflies(col,p,t);
  float m2=mist(p,t,150.0,180.0,0.024,0.55,9.0);
  col=mix(col,${c3('#7a68b8')},step(bayer(p+vec2(2.0,1.0)),m2*0.7)*0.38);
  vec4 g2=grassLayer(p,t,1.6,0.0,0.0,0.0,0.0,0.0,4.0,5.0,3.0,1.0,${c3('#1f5a5a')},${c3('#2a7a6a')},${c3('#3b8a78')}); col=mix(col,g2.rgb,g2.a);
  return col;
}
`;

// ============================================================================================
// SUNSET SEA - the sun slowly sinks and rises (~90 s loop) while the palette shifts from golden
// to dusk, rolling waves with a perspective parallax, wavy reflections of sky, clouds and
// islands, a glittering sun path, a sailboat and gulls.
// ============================================================================================
const SEA = () => `
const float HZ=100.0;

vec3 skyCol(vec2 p,float t,float cyc,vec2 sc){
  vec3 a=sky6(p,0.0,HZ,${c3('#7a6bd6')},${c3('#b27ad0')},${c3('#e88fc0')},${c3('#ff9fae')},${c3('#ffbf9b')},${c3('#ffdf9f')});
  vec3 b=sky6(p,0.0,HZ,${c3('#2f2a7a')},${c3('#5b3a95')},${c3('#a24a9c')},${c3('#e0607f')},${c3('#ff8a5c')},${c3('#ffc074')});
  vec3 col=mix(a,b,step(bayer(p+vec2(2.0,1.0)),floor(cyc*5.0+0.5)/5.0));
  col=sun(col,p,sc,24.0,mix(${c3('#ffd98a')},${c3('#ff9a58')},cyc),mix(${c3('#fff0b8')},${c3('#ffd08a')},cyc),mix(${c3('#ffd9a0')},${c3('#ff9a78')},cyc),t,1.0);
  col=clouds(col,p,t,4.0,mix(vec3(1.0),${c3('#ffd2c0')},cyc),mix(${c3('#ffb4c4')},${c3('#e0707f')},cyc));
  return col;
}
vec3 waterCol(vec2 p,float t,float cyc,vec2 sc){
  float dy=p.y-HZ;
  float wv=sin(p.x*0.05+t*1.1+dy*0.15)*1.6+sin(p.x*0.13-t*0.7)*0.8;
  float g=clamp((dy+wv)/80.0,0.0,0.999)*4.0;
  float i=floor(g), fr=fract(g);
  float up=step(bayer(p),clamp((fr-0.45)*1.8,0.0,1.0));
  vec3 wa=mix(mix(${c3('#5b8fd6')},${c3('#4f80cc')},step(0.5,i)),mix(${c3('#4572c0')},${c3('#3a64b2')},step(2.5,i)),step(1.5,i));
  vec3 wa2=mix(mix(${c3('#5b8fd6')},${c3('#4f80cc')},step(0.5,min(i+1.0,3.0))),mix(${c3('#4572c0')},${c3('#3a64b2')},step(2.5,min(i+1.0,3.0))),step(1.5,min(i+1.0,3.0)));
  vec3 wb=mix(mix(${c3('#4a5db8')},${c3('#3f52a8')},step(0.5,i)),mix(${c3('#364598')},${c3('#2d3a88')},step(2.5,i)),step(1.5,i));
  vec3 base=mix(mix(wa,wa2,up),wb,cyc*0.8);

  // reflection: mirrored sky, rows jittered sideways so it breaks up like real water
  float jit=floor(sin(dy*1.1+t*1.4)*(1.0+dy*0.05)+sin(dy*0.37-t*0.8)*1.5+0.5);
  vec2 rp=vec2(p.x+jit,HZ-1.0-floor(dy*0.62));
  vec3 refl=skyCol(rp,t,cyc,sc);
  vec3 col=mix(base,refl*0.92,mix(0.6,0.22,smoothstep(0.0,55.0,dy)));
  vec4 ib=tex(u_back,vec2(p.x+jit,HZ-floor(dy*0.8)));
  col=mix(col,${c3('#40306f')},ib.a*0.5);

  // glittering sun path
  float gw=max(8.0,46.0-dy*0.5);
  float inCol=step(abs(p.x-(sc.x+sin(t*0.7+dy*0.4)*3.0)),gw*0.5);
  float seg=floor(p.x/5.0);
  float flick=step(0.45,h21(vec2(seg,p.y+floor(t*2.5+h11(p.y)*3.0))));
  float rowOn=step(0.3,h11(p.y*3.1));
  col=mix(col,mix(${c3('#ffe9a6')},${c3('#ffc27a')},cyc),inCol*flick*rowOn*0.9);

  // rolling wave lines - speed and length grow with depth (cheap perspective)
  float rw=step(0.5,h11(p.y*2.3));
  float spd=(0.15+dy/80.0*0.9)*30.0;
  float per=24.0+h11(p.y+5.0)*20.0;
  float u=mod(p.x-spd*t*(h11(p.y*1.3)>0.5?1.0:-1.0)-h11(p.y)*50.0,per);
  float ln=4.0+dy*0.07+h11(p.y+9.0)*4.0;
  col=mix(col,mix(${c3('#cfe9f5')},${c3('#ffd9e6')},cyc),rw*step(u,ln)*0.7);
  // sparkles
  col=mix(col,vec3(1.0),step(0.987,h21(floor(p*vec2(0.5,1.0))+floor(t*3.0)))*0.8);
  // horizon haze
  col=mix(col,mix(${c3('#ffe9b0')},${c3('#ffb48a')},cyc),(1.0-smoothstep(0.0,5.0,dy))*0.55);
  return col;
}

vec3 scene(vec2 p){
  float t=u_t;
  float cyc=0.5+0.5*sin(t*0.07-1.2);                    // slow sunset cycle, 0 = golden, 1 = dusk
  vec2 sc=vec2(160.0,88.0+19.0*cyc);                    // sun sinks towards the sea
  vec3 col;
  if(p.y<HZ) col=skyCol(p,t,cyc,sc);
  else col=waterCol(p,t,cyc,sc);
  vec4 b=tex(u_back,p); col=mix(col,b.rgb,b.a);

  // sailboat gliding along the horizon
  float bx=floor(mod(t*3.2+240.0,420.0))-50.0;
  float bob=floor(sin(t*1.1)*0.6+0.5);
  vec2 d=p-vec2(bx,102.0+bob);
  float hull=rect(d,vec2(0.0,0.0),vec2(10.0,2.0));
  float mast=rect(d,vec2(4.0,-10.0),vec2(1.0,10.0));
  float sail=0.0;
  for(int r=0;r<8;r++){ float fr=float(r); sail+=rect(d,vec2(5.0,-9.0+fr),vec2(floor(fr*0.75)+1.0,1.0)); }
  col=mix(col,mix(${c3('#fff0e0')},${c3('#ffc8b0')},cyc),clamp(sail,0.0,1.0));
  col=mix(col,${c3('#3d2c5a')},clamp(hull+mast,0.0,1.0));

  vec4 ws=windStreaks(p,t,0.45,${c3('#bfa0cf')},${c3('#ffe6f0')}); col=mix(col,ws.rgb,ws.a*step(p.y,HZ-3.0));

  // gulls
  for(int i=0;i<4;i++){
    float fi=float(i);
    float x=mod(fi*80.0+(0.25+fi*0.05)*60.0*t,W+20.0)-10.0;
    float y=floor(30.0+fi*12.0+sin(t*0.9+fi)*3.0);
    vec2 gd=p-vec2(floor(x),y);
    float up=step(0.0,sin(t*10.0+fi*2.0));
    float m=rect(gd,vec2(0.0,0.0),vec2(3.0,1.0))+px(gd,-1.0,up>0.5?-1.0:1.0)+px(gd,3.0,up>0.5?-1.0:1.0);
    col=mix(col,${c3('#4a3a5c')},clamp(m,0.0,1.0));
  }
  return col;
}
`;

const SCENES = { sakura: SAKURA, meadow: MEADOW, night: NIGHT, sea: SEA };

export const buildFragment = (theme) => HEAD + COMMON + (SCENES[theme] || SCENES.meadow)() + MAIN;
