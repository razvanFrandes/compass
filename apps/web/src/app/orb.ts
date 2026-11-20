import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, signal, viewChild } from '@angular/core';

/*
  Kassandra orb: a fragment-shader sphere on one full-screen triangle, no libraries.
  Voice drives size (+11%), silhouette wobble (0.6% → 3.4% of the radius), internal flow speed and rim light.
  Hue never follows the level: colour is the brand (Juyo's Kassandra gradient), motion is the signal.
  Simplex noise: Ashima Arts / stegu webgl-noise, MIT licence (https://github.com/stegu/webgl-noise).
  Reduced motion: time is frozen and the level only brightens the rim (WCAG 2.3.3).
*/

const NOISE = `
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

const FS = `precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uLevel; uniform float uMotion;
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
${NOISE}
vec3 ramp(float f){ f=clamp(f,0.0,1.0); return f<0.5 ? mix(uC1,uC2,f*2.0) : mix(uC2,uC3,(f-0.5)*2.0); }
void main(){
  vec2 p=(gl_FragCoord.xy-0.5*uRes)/(0.5*min(uRes.x,uRes.y));
  float lv=clamp(uLevel,0.0,1.0);
  float R=0.62+0.07*lv*uMotion;
  float a=atan(p.y,p.x);
  float wob=snoise(vec3(cos(a)*0.9,sin(a)*0.9,uTime*0.25))*(0.006+0.028*lv)*uMotion;
  float edge=R*(1.0+wob);
  float r=length(p);
  float px=1.5/min(uRes.x,uRes.y);
  float inside=1.0-smoothstep(edge-px,edge+px,r);
  vec2 q=p/edge;
  float z=sqrt(max(0.0,1.0-dot(q,q)));
  vec3 n=normalize(vec3(q,z));
  float t=uTime*(0.10+0.25*lv*uMotion);
  vec3 np=n*1.2+vec3(0.0,0.0,t);
  n=normalize(n+(0.05+0.09*lv*uMotion)*vec3(snoise(np+7.0),snoise(np+19.0),0.0));
  float w=snoise(vec3(q*0.6,t*0.6+3.0));
  float flow=snoise(vec3(q*0.75+0.45*vec2(w,-w),t*0.5));
  float f=0.5+0.38*dot(q,vec2(0.62,-0.62))+0.30*flow;
  vec3 V=vec3(0.0,0.0,1.0);
  vec3 L=normalize(vec3(-0.45,0.55,0.75));
  float diff=clamp(dot(n,L),0.0,1.0);
  float fres=pow(1.0-clamp(dot(n,V),0.0,1.0),2.4);
  float spec=pow(clamp(dot(n,normalize(L+V)),0.0,1.0),32.0);
  vec3 col=ramp(f)*(0.42+0.58*diff);
  col+=fres*ramp(f*0.5+fres*0.7)*(0.45+(0.45*uMotion+0.10*(1.0-uMotion))*lv);
  col+=spec*0.16;
  float d=max(r-edge,0.0);
  float glow=exp(-d*18.0)*(0.05+0.18*lv)*(1.0-inside);
  gl_FragColor=vec4(col*inside+ramp(0.55)*glow, clamp(inside+glow,0.0,1.0));
}`;

const VS = `attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

@Component({
  selector: 'app-kassandra-orb',
  host: { class: 'relative block', 'aria-hidden': 'true' },
  template: `
    @if (fallback()) {
      <span class="orb-fallback absolute inset-[19%] rounded-full" [style.transform]="'scale(' + (1 + fallbackLevel() * 0.1) + ')'"></span>
    } @else {
      <canvas #canvas class="block size-full"></canvas>
    }
  `,
})
export class KassandraOrb {
  /** Read every frame; never written as a signal per frame. 0..1. */
  readonly levelSource = input<() => number>(() => 0);
  readonly active = input(true);

  protected readonly fallback = signal(false);
  protected readonly fallbackLevel = signal(0);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private raf = 0;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const canvas = this.canvas()?.nativeElement;
      const gl = canvas?.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!canvas || !gl) {
        this.fallback.set(true);
        const tick = () => {
          this.fallbackLevel.set(reduce ? 0 : this.levelSource()());
          this.raf = requestAnimationFrame(tick);
        };
        tick();
        destroy.onDestroy(() => cancelAnimationFrame(this.raf));
        return;
      }
      const compile = (type: number, src: string) => {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        return sh;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        this.fallback.set(true);
        return;
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = (n: string) => gl.getUniformLocation(prog, n);
      const uRes = u('uRes');
      const uTime = u('uTime');
      const uLevel = u('uLevel');
      gl.uniform1f(u('uMotion'), reduce ? 0 : 1);
      gl.uniform3fv(u('uC1'), hex('#6FA0FB'));
      gl.uniform3fv(u('uC2'), hex('#A78CFB'));
      gl.uniform3fv(u('uC3'), hex('#EB75BE'));
      gl.clearColor(0, 0, 0, 0);

      let w = 0;
      let h = 0;
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = this.host.getBoundingClientRect();
        const nw = Math.max(1, Math.round(rect.width * dpr));
        const nh = Math.max(1, Math.round(rect.height * dpr));
        if (nw !== w || nh !== h) {
          w = canvas.width = nw;
          h = canvas.height = nh;
          gl.viewport(0, 0, w, h);
          gl.uniform2f(uRes, w, h);
        }
      };

      let time = 3;
      let last = performance.now();
      const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!document.hidden) {
          resize();
          if (!reduce && this.active()) time += dt;
          gl.uniform1f(uTime, time);
          gl.uniform1f(uLevel, this.levelSource()());
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);

      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        cancelAnimationFrame(this.raf);
        this.fallback.set(true);
      });
      destroy.onDestroy(() => {
        cancelAnimationFrame(this.raf);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      });
    });
  }
}
