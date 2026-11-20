/*
  GLSL for the Kassandra orb (WebGL2, GLSL ES 3.00). Three passes per frame:

  1. SCENE     the orb itself: an icosphere displaced in the vertex shader, shaded as glass over plasma.
  2. FEEDBACK  last frame's trail buffer, zoomed, rotated, wave-warped and faded (the MilkDrop idea),
               plus this frame's orb and the waveform ring.
  3. COMPOSITE trails behind, orb in front, onto the transparent canvas.

  Simplex noise: Ashima Arts / Stefan Gustavson, webgl-noise, MIT licence (https://github.com/stegu/webgl-noise).
*/

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/*
  The Kassandra gradient as a loop: blue → violet → pink → violet → blue.
  Cycling the offset moves colour through the brand without ever leaving it.
*/
const RAMP = /* glsl */ `
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
vec3 ramp(float f){
  float t=1.0-abs(fract(f)*2.0-1.0);
  t=t*t*(3.0-2.0*t);
  return t<0.5 ? mix(uC1,uC2,t*2.0) : mix(uC2,uC3,t*2.0-1.0);
}`;

export const SCENE_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat3 uRot;
uniform vec3 uPole; uniform vec3 uWaveA;
uniform float uScale, uAmp, uFreq, uFlowT, uRipple, uRippleT, uPulse, uPulseT, uTwist;
uniform float uFocal, uDist;
uniform float uSH[9];
out vec3 vN; out vec3 vP; out vec3 vO; out float vD;
${NOISE}

// Height of the surface above the unit sphere in direction n.
float field(vec3 n){
  // Swirl: turn each latitude by a different angle around the vertical axis.
  float a=uTwist*n.y; float c=cos(a), s=sin(a);
  vec3 q=vec3(c*n.x-s*n.z, n.y, s*n.x+c*n.z);

  // Two octaves of simplex noise drifting through the sphere: the slow morph.
  vec3 fl=vec3(0.0, uFlowT*0.6, uFlowT);
  float d=uAmp*(0.88*snoise(q*uFreq+fl)+0.12*snoise(q*uFreq*2.0-fl.zxy*1.3+11.0));

  // Spherical harmonics, degrees 2 and 3: the whole body leans and bulges (bass).
  float x=q.x, y=q.y, z=q.z;
  d+=uSH[0]*x*y*2.0 + uSH[1]*y*z*2.0 + uSH[2]*(3.0*z*z-1.0)*0.5 + uSH[3]*x*z*2.0 + uSH[4]*(x*x-y*y)
    +uSH[5]*y*(3.0*x*x-y*y) + uSH[6]*x*y*z*2.6 + uSH[7]*z*(5.0*z*z-3.0)*0.5 + uSH[8]*x*(x*x-3.0*y*y);

  // Swirl ridges: three lobes around the vertical axis, wound into a spiral by the twist above (thinking).
  d+=0.034*uTwist*x*(x*x-3.0*z*z);

  // Ripples (mids): one train of waves crossing the body, its fronts bent by noise like wind over water.
  d+=uRipple*sin(dot(q,uWaveA)*6.5+1.6*snoise(q*0.7+fl.yzx)-uRippleT*2.6);

  // Rings leaving the pole that faces the viewer, fading towards the far side (speaking).
  float th=acos(clamp(dot(n,uPole),-1.0,1.0));
  d+=uPulse*sin(th*6.0-uPulseT)*exp(-th*0.5)*smoothstep(0.0,0.4,th);
  return d;
}

void main(){
  vec3 n=aPos;
  // Normal of the displaced surface from two neighbours a small step away.
  vec3 t=normalize(cross(n, abs(n.y)<0.9 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0)));
  vec3 b=cross(n,t);
  const float e=0.012;
  float d0=field(n);
  vec3 n1=normalize(n+t*e); vec3 n2=normalize(n+b*e);
  vec3 p0=n*(1.0+d0);
  vec3 p1=n1*(1.0+field(n1));
  vec3 p2=n2*(1.0+field(n2));
  vec3 N=normalize(cross(p1-p0,p2-p0));

  vec3 world=uRot*p0*uScale;
  vec3 view=world-vec3(0.0,0.0,uDist);
  vN=uRot*N; vP=view; vO=n; vD=d0;
  const float near=1.0, far=12.0;
  gl_Position=vec4(uFocal*view.x, uFocal*view.y, -view.z*(far+near)/(far-near)-2.0*far*near/(far-near), -view.z);
}`;

export const SCENE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vN; in vec3 vP; in vec3 vO; in float vD;
uniform mat3 uRotT;
uniform float uPlasmaT, uHueT, uGlow, uRim, uSparkle, uTime, uAmp, uTwist;
out vec4 o;
${NOISE}
${RAMP}

void main(){
  vec3 N=normalize(vN);
  vec3 V=normalize(-vP);
  float ndv=clamp(dot(N,V),0.0,1.0);
  float fres=pow(1.0-ndv,3.0);
  float lift=clamp(vD/(uAmp+0.12),-1.0,1.0);

  // Inside the glass: follow the refracted ray and read a slow, warped colour field at two depths.
  // The warp (noise fed into noise) is what makes it flow like liquid instead of sliding like a texture.
  // The plasma is wound by the same twist as the surface, so a thinking orb swirls all the way through.
  float ta=uTwist*1.3*vO.y; float tc=cos(ta), ts=sin(ta);
  vec3 Po=vec3(tc*vO.x-ts*vO.z, vO.y, ts*vO.x+tc*vO.z)*(1.0+vD);
  vec3 Ro=uRotT*refract(-V,N,0.72);
  float t=uPlasmaT;
  float w1=snoise(Po*0.85+Ro*0.22+vec3(0.0,t*0.30,1.7));
  float w2=snoise(Po*1.25+Ro*0.55+vec3(0.9*w1,-t*0.24,0.7*w1)+4.0);
  float field=0.5+0.5*(0.62*w1+0.38*w2);

  // Colour: the gradient runs from the upper left (blue) to the lower right (pink), like the brand mark,
  // bent by the flowing field and slid by the colour cycle. Ridges lean pink, hollows lean blue.
  float g=0.5+0.5*dot(N.xy,vec2(0.62,-0.62));
  float hue=uHueT+0.5*(0.60*g+0.40*smoothstep(0.10,0.90,field))+0.04*lift;
  vec3 c=ramp(hue);
  vec3 deep=c*c*vec3(0.80,0.74,0.92); // the same hue, darker and more saturated: the shadow side of the glass

  vec3 L=normalize(vec3(-0.45,0.62,0.64));
  float wrap=0.5+0.5*dot(N,L);
  float shade=clamp(0.06+0.94*wrap*wrap+0.22*lift,0.0,1.0)*mix(0.70,1.0,1.0-ndv*ndv);
  vec3 col=mix(deep*0.50,c*0.96,smoothstep(0.0,1.0,shade));

  // Plasma: 1 - |noise| raised to a power draws luminous filaments; two depths give parallax as it turns.
  vec3 plasma=vec3(0.0);
  for(int i=0;i<2;i++){
    float fi=float(i);
    vec3 p=Po*1.12+Ro*(0.30+0.42*fi)+vec3(0.75*w2,0.75*w1,-0.6*w2)+vec3(t*0.20,5.0*fi,-t*0.26);
    float f=snoise(p);
    float filament=pow(1.0-abs(f),3.6+1.4*fi);
    plasma+=mix(ramp(hue+0.10+0.14*fi),vec3(1.0),0.26)*filament*(0.40-0.12*fi);
  }
  col+=plasma*min(uGlow,1.35)*(0.30+0.70*ndv)*(0.50+0.50*field);

  // Fresnel rim in the gradient, with a thin near-white edge.
  vec3 rimCol=ramp(uHueT+0.5*g+0.06);
  col+=mix(rimCol,vec3(1.0),0.22)*fres*uRim*0.85;
  col+=vec3(1.0,0.97,1.0)*pow(fres,6.0)*0.45*uRim;

  // A soft window highlight.
  float nh=max(dot(N,normalize(L+V)),0.0);
  col+=vec3(1.0)*(pow(nh,90.0)*0.55+pow(nh,12.0)*0.10);

  // Sparkle (highs): arcs of light that run along the rim and flick on and off.
  float s=snoise(vO*6.5+uTime*vec3(0.9,1.7,-1.1));
  col+=mix(vec3(1.0),rimCol,0.4)*pow(1.0-ndv,3.4)*smoothstep(0.0,0.7,s)*uSparkle*1.7;

  // Gentle shoulder, so bright moments roll off instead of clipping.
  col=col/(1.0+0.16*col*col);
  o=vec4(col,1.0);
}`;

/** One triangle that covers the screen. */
export const QUAD_VS = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUv;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2));
  vUv=p;
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

export const FEEDBACK_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev; uniform sampler2D uScene;
uniform vec2 uTexel;
uniform float uDecay, uZoom, uRot, uWarp, uTime, uInject, uRing, uRingR, uHueT;
uniform vec3 uTint;
uniform float uBands[8];
out vec4 o;
${RAMP}

void main(){
  vec2 p=vUv*2.0-1.0;
  float r=length(p);

  // Where this pixel's light was one frame ago: a little nearer the centre (zoom), turned (rotation),
  // and pushed by slow crossing waves (warp). Applied every frame, light streams outwards and curls.
  float c=cos(uRot), s=sin(uRot);
  vec2 q=mat2(c,-s,s,c)*p/uZoom;
  vec2 wave=vec2(sin(p.y*3.7+uTime*0.83)+sin((p.x+p.y)*2.3-uTime*0.57),
                 cos(p.x*4.1-uTime*0.71)+cos((p.x-p.y)*2.9+uTime*0.49));
  q+=wave*uWarp*0.0021;
  vec2 uv=q*0.5+0.5;
  vec3 prev=0.25*(texture(uPrev,uv+uTexel*vec2( 0.6, 0.6)).rgb+texture(uPrev,uv+uTexel*vec2(-0.6, 0.6)).rgb
                 +texture(uPrev,uv+uTexel*vec2( 0.6,-0.6)).rgb+texture(uPrev,uv+uTexel*vec2(-0.6,-0.6)).rgb);
  // Fade, and cool slightly with age: a trail leaves pink and arrives blue, along the gradient.
  prev=max(prev*uDecay*uTint-0.0012,0.0);

  vec4 scene=texture(uScene,vUv);
  vec3 col=prev+scene.rgb*uInject;

  // The waveform: a thin ring just outside the orb whose radius follows the bands. Each frame's ring is
  // carried outwards by the zoom, so a voice leaves ripples behind it.
  float th=atan(p.y,p.x);
  float w=0.0;
  for(int i=0;i<8;i++){ float fi=float(i); w+=uBands[i]*sin(th*(fi+2.0)+uTime*(1.1+0.6*fi)+fi*1.7); }
  float rr=uRingR*(1.0+0.022*w);
  float line=exp(-pow((r-rr)/0.011,2.0))*(1.0-scene.a);
  // Drawn in beats, about seven a second, so the zoom spaces them out into separate ripples.
  float beat=pow(0.5+0.5*sin(uTime*44.0),3.0);
  col+=ramp(th/6.2831853+uHueT+0.15)*line*uRing*(0.12+1.05*beat);
  o=vec4(col,1.0);
}`;

export const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene; uniform sampler2D uTrail;
uniform float uHalo, uBloom;
out vec4 o;

float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }

void main(){
  vec2 p=vUv*2.0-1.0;
  vec4 scene=texture(uScene,vUv);
  vec3 trail=texture(uTrail,vUv).rgb;

  // The halo fades to nothing before the edge of the canvas, so the square never shows.
  float mask=smoothstep(1.0,0.55,length(p));
  vec3 halo=1.0-exp(-trail*uHalo*mask*1.25);
  float ha=max(halo.r,max(halo.g,halo.b));

  // Premultiplied: orb over halo, plus a little of the trail on the orb itself as bloom.
  vec3 col=scene.rgb+halo*(1.0-scene.a)+trail*scene.a*uBloom;
  float a=scene.a+ha*(1.0-scene.a);
  col+=(hash(gl_FragCoord.xy)-0.5)/255.0*a; // dither: no banding in the soft falloff
  o=vec4(min(col,vec3(a)),a);
}`;
