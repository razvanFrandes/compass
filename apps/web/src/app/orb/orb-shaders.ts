/*
  GLSL for the Kassandra orb (WebGL2, GLSL ES 3.00): a sphere made of points.

  There is no geometry: the vertex shader places point `gl_VertexID` on a Fibonacci spiral (lattice.ts),
  pushes it out from the centre by what the voice is doing at its latitude, turns the sphere and projects it.
  The fragment shader draws each point as a soft round dot in the Kassandra gradient.
*/

/*
  The Kassandra gradient as a loop: blue → violet → pink → violet → blue.
  Moving the offset slides colour through the brand without ever leaving it.
*/
const RAMP = /* glsl */ `
const vec3 C1=vec3(0.435,0.627,0.984); // #6FA0FB
const vec3 C2=vec3(0.655,0.549,0.984); // #A78CFB
const vec3 C3=vec3(0.922,0.459,0.745); // #EB75BE
vec3 ramp(float f){
  float t=1.0-abs(fract(f)*2.0-1.0);
  t=t*t*(3.0-2.0*t);
  return t<0.5 ? mix(C1,C2,t*2.0) : mix(C2,C3,t*2.0-1.0);
}`;

export const POINTS_VS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uCount, uDist, uFocal, uDotBase;
uniform float uScale, uLift, uWave, uRipple, uPulse, uSpiral, uDot, uSparkle;
uniform float uSpinT, uWaveT, uPulseT, uSpiralT, uTwinkleT, uTime, uHue;
uniform float uBands[8];
out float vAlpha; out float vHue;

// The eight bands read as one smooth curve: 0 is the lowest band, 1 the highest.
float band(float x){
  x=clamp(x,0.0,1.0)*7.0; int i=int(floor(x)); float f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(uBands[i],uBands[min(i+1,7)],f);
}

void main(){
  // Fibonacci sphere: even heights, each point a golden angle further round.
  float i=float(gl_VertexID);
  float y=1.0-2.0*(i+0.5)/uCount;
  float rad=sqrt(1.0-y*y);
  float ph=i*2.39996323;
  vec3 q=vec3(cos(ph)*rad,y,sin(ph)*rad);

  // Each latitude is a frequency: bass at the equator, highs at the poles, mirrored north and south.
  float lat=abs(y);
  float e=band(lat)*uLift;
  // Part of that lift rides a wave travelling from pole to pole, so a held note still moves.
  float w=0.5+0.5*sin(y*9.0-uWaveT);
  float d=1.0+e*(1.0-uWave+uWave*w);
  // A slow swell that is always there.
  d+=uRipple*sin(q.x*2.5+y*3.0-uTime*0.8);
  // Speaking: rings leave the equator towards both poles.
  d+=uPulse*sin(lat*10.0-uPulseT)*(1.0-0.35*lat);
  // Thinking: a three-armed spiral winds around the axis.
  d+=uSpiral*sin(atan(q.z,q.x)*3.0+y*7.0-uSpiralT);
  q*=d*uScale;

  // Turn around the vertical axis, then tip the top towards the viewer.
  float c=cos(uSpinT), s=sin(uSpinT);
  q=vec3(c*q.x+s*q.z,q.y,-s*q.x+c*q.z);
  q=vec3(q.x,0.93*q.y-0.36*q.z,0.36*q.y+0.93*q.z);

  float persp=1.0/(uDist-q.z);
  gl_Position=vec4(q.xy*persp*uFocal,0.0,1.0);

  // Nearer points are larger and brighter; lifted points grow; highs make points flick.
  float tw=0.5+0.5*sin(i*7.13+uTwinkleT);
  gl_PointSize=min(uRes.x,uRes.y)*0.021*uDotBase*uDot*persp*(1.0+2.4*e+1.2*uSparkle*tw);
  vAlpha=(0.22+0.78*smoothstep(-1.1,1.1,q.z))*(1.0+0.5*uSparkle*tw);
  // Blue at the bottom to pink at the top, warmer where the voice lifts the surface.
  vHue=uHue+0.5*(y*0.5+0.5)+0.4*e;
}`;

export const POINTS_FS = /* glsl */ `#version 300 es
precision highp float;
in float vAlpha; in float vHue;
uniform float uGlow, uLight;
out vec4 o;
${RAMP}

void main(){
  float m=smoothstep(0.5,0.08,length(gl_PointCoord-0.5));
  vec3 c=ramp(vHue);
  // On a light page the same hues, deeper and more saturated, so the dots still read.
  c=mix(c,c*c*vec3(0.80,0.74,0.92),uLight);
  float a=min(m*vAlpha*uGlow,1.0);
  // Premultiplied. On dark the alpha is held back, so overlapping dots add up to a glow;
  // on light it is full, so dots cover what is behind them.
  o=vec4(c*a,a*mix(0.55,1.0,uLight));
}`;
