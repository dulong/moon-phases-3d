(() => {
  'use strict';
  const root=document.getElementById('moon-3d-lab'),q=s=>root.querySelector(s);
  const canvas=q('.m3-world'),closeup=q('.m3-closeup'),slider=q('#m3-age'),play=q('[data-play]'),speedSelect=q('#m3-speed');
  const tau=Math.PI*2,cycle=29.5,radius=4.2;
  const phases=['新月','蛾眉月','上弦月','盈凸月','满月','亏凸月','下弦月','残月'];
  const descriptions=['月球位于太阳与地球之间，朝向我们的半球几乎没有被照亮。','月球逐渐远离太阳方向，右侧出现一弯明亮的月牙。','从地球看，月球的右半面被阳光照亮。','月面大部分已经明亮，亮区继续增加。','太阳与月球位于地球两侧，朝向我们的月面几乎全部明亮。','满月之后，右侧的亮区开始减少。','从地球看，月球的左半面被阳光照亮。','亮区继续缩小，只留下左侧一弯月牙。'];
  const hemisphere=q('.m3-hemisphere'),projection=q('.m3-projection'),projectionContext=projection.getContext('2d');
  let lessonMode=3,aligned=false,eduAzimuth=.78,eduElevation=.42,eduCameraTween=null,eduBlend=0;
  let activeMode='phase',eclipse=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let day=9.14,visualDay=day,speed=1,playing=false,view='orbit',azimuth=.32,elevation=.64,distance=14.2,previous=0,frameId,dirty=true,tween=null;
  const palette={moon:[.89,.87,.83],night:[.035,.047,.067],earth:[.045,.29,.61],land:[.16,.43,.25],cloud:[.87,.94,1],sun:[1,.77,.32],hot:[1,.32,.045],orbit:[.27,.44,.58],ray:[.95,.68,.26],sight:[.30,.83,.88]};
  const sub=(a,b)=>a.map((v,i)=>v-b[i]), dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], unit=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function multiply(a,b) { const m=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m; }
  function perspective(fov,aspect) {const f=1/Math.tan(fov/2),n=.05,z=120;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(z+n)/(n-z),-1,0,0,2*z*n/(n-z),0]);}
  function orthographic(aspect){const y=2.02*Math.max(1,1/aspect),x=y*aspect;return new Float32Array([1/x,0,0,0,0,1/y,0,0,0,0,-2/120,0,0,0,-1,1]);}
  function lookAt(eye,target,up=[0,1,0]) {const z=unit(sub(eye,target)),x=unit(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
  function model(pos,size,rot=0) {const c=Math.cos(rot)*size,s=Math.sin(rot)*size;return new Float32Array([c,0,-s,0,0,size,0,0,s,0,c,0,...pos,1]);}
  function moonPosition() {const a=visualDay/cycle*tau;return [-radius*Math.cos(a),0,radius*Math.sin(a)];}
  const vertex=`precision mediump float;attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uVP;uniform mat4 uModel;varying vec3 vLocal;varying vec3 vNormal;varying vec3 vWorld;void main(){vLocal=aPosition;vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vNormal=mat3(uModel)*aNormal;gl_Position=uVP*world;}`;
  const fragment=`precision mediump float;varying vec3 vLocal;varying vec3 vNormal;varying vec3 vWorld;uniform vec3 uColor;uniform vec3 uSecond;uniform vec3 uCloud;uniform vec3 uNight;uniform vec3 uEye;uniform vec3 uLight;uniform vec4 uCraters[24];uniform float uKind;uniform float uAlpha;uniform float uExplain;uniform vec3 uToEarth;uniform vec4 uShadow;uniform vec3 uShadowOffset;uniform mat4 uModel;
  float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.71,.29));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 x){vec3 p=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(p),hash(p+vec3(1,0,0)),f.x),mix(hash(p+vec3(0,1,0)),hash(p+vec3(1,1,0)),f.x),f.y),mix(mix(hash(p+vec3(0,0,1)),hash(p+vec3(1,0,1)),f.x),mix(hash(p+vec3(0,1,1)),hash(p+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){return .55*noise(p)+.27*noise(p*2.03)+.12*noise(p*4.11)+.06*noise(p*8.17);}
  void main(){if(uKind>3.5){gl_FragColor=vec4(uColor,uAlpha);return;}vec3 p=normalize(vLocal),normal=normalize(vNormal),base=uColor;float grain=fbm(p*19.0);
  if(uKind<.5&&uExplain>.5){float lit=step(0.0,dot(normal,normalize(uLight))),seen=step(0.0,dot(normal,normalize(uToEarth)));vec3 c=vec3(.075,.10,.15);if(uExplain<1.5)c=mix(c,vec3(.98,.62,.20),lit);else if(uExplain<2.5)c=mix(c,vec3(.16,.64,.76),seen);else{c=mix(c,vec3(.98,.62,.20),lit);c=mix(c,vec3(.16,.64,.76),seen*(1.0-lit));c=mix(c,vec3(.96,.93,.62),lit*seen);}float shape=.45+.55*max(0.0,dot(normal,normalize(uEye-vWorld)));gl_FragColor=vec4(c*shape,1.0);return;}
  if(uKind<.5){float maria=smoothstep(.38,.61,fbm(p*3.4+vec3(7.0)));base*=.54+.30*grain+.23*maria;vec3 bump=vec3(0);float texture=1.0;for(int i=0;i<24;i++){vec3 delta=p-uCraters[i].xyz;float r=uCraters[i].w,d=length(delta)/r;float pit=1.0-smoothstep(.1,.85,d);float rim=exp(-pow((d-.88)*9.0,2.0));texture*=1.0-.22*pit+.24*rim;bump+=delta/r*(pit*.29-rim*.22);}normal=normalize(normal+mat3(uModel)*bump);base*=texture;}
  else if(uKind<1.5){float land=smoothstep(.49,.54,fbm(p*3.7));base=mix(base,uSecond,land);float clouds=smoothstep(.60,.76,fbm(p*8.0+vec3(3.0)));float caps=smoothstep(.85,.98,abs(p.y));base=mix(base,uCloud,max(clouds*.8,caps*.85));}
  else{float detail=fbm(p*13.0);float edge=pow(max(0.0,dot(normal,normalize(uEye-vWorld))),.35);gl_FragColor=vec4(mix(uSecond,uColor,.55+.35*detail)*(.7+.3*edge),1.0);return;}
  float cosine=dot(normal,normalize(uLight));float day=smoothstep(-.015,.015,cosine);float diffuse=.19+.81*max(0.0,cosine);vec3 lit=base*diffuse;float rim=pow(1.0-max(0.0,dot(normal,normalize(uEye-vWorld))),3.0);if(uKind>.5){vec3 halfVector=normalize(normalize(uLight)+normalize(uEye-vWorld));float ocean=1.0-smoothstep(.49,.54,fbm(p*3.7));lit+=vec3(.60,.82,1.0)*pow(max(0.0,dot(normal,halfVector)),36.0)*ocean*.38;lit+=vec3(.12,.47,1.0)*rim*.55;}if(uKind<.5&&uShadow.x>.5){vec3 point=vWorld+uShadowOffset;float x=max(0.0,point.x),r=length(point.yz),umbra=max(0.0,uShadow.y-uShadow.z*x),penumbra=uShadow.y+uShadow.w*x;float total=1.0-smoothstep(umbra-.025,umbra+.025,r);float dim=1.0-smoothstep(umbra,penumbra,r);lit*=1.0-.63*dim;vec3 red=base*vec3(.33,.070,.025)*(.30+.70*max(0.0,cosine));lit=mix(lit,red,total);}
  gl_FragColor=vec4(mix(uNight*(.8+.2*grain),lit,day),1.0);}`;
  let seed=83;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const craterValues=[];for(let i=0;i<24;i++){const y=rand()*1.8-.9,a=rand()*tau,s=Math.sqrt(1-y*y);craterValues.push(Math.cos(a)*s,y,Math.sin(a)*s,.04+rand()*.13);}
  function Renderer(element) {
    const gl=element.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('当前设备没有提供 WebGL，无法显示 3D 场景。');
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);const attrs={p:gl.getAttribLocation(program,'aPosition'),n:gl.getAttribLocation(program,'aNormal')},names=['VP','Model','Color','Second','Cloud','Night','Eye','Light','Kind','Alpha','Explain','ToEarth','Shadow','ShadowOffset','Craters[0]'],u={};names.forEach(n=>u[n]=gl.getUniformLocation(program,'u'+n));
    const pos=[],indices=[],cols=96,rows=64;for(let y=0;y<=rows;y++){const t=y/rows*Math.PI;for(let x=0;x<=cols;x++){const a=x/cols*tau;pos.push(Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a));}}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
    function buffer(data,target=gl.ARRAY_BUFFER){const b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
    const sphereBuffer=buffer(new Float32Array(pos)),indexBuffer=buffer(new Uint16Array(indices),gl.ELEMENT_ARRAY_BUFFER),lineBuffer=buffer(new Float32Array(600));
    function positions(b,normals=true){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(attrs.p);gl.vertexAttribPointer(attrs.p,3,gl.FLOAT,false,0,0);if(normals){gl.enableVertexAttribArray(attrs.n);gl.vertexAttribPointer(attrs.n,3,gl.FLOAT,false,0,0);}else{gl.disableVertexAttribArray(attrs.n);gl.vertexAttrib3f(attrs.n,0,1,0);}}
    const api={gl,vp:identity(),eye:[0,0,20],width:0,height:0,
      begin(vp,eye,explain=0,toEarth=[1,0,0],shadow=null){const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(element.clientWidth*dpr)),h=Math.max(1,Math.round(element.clientHeight*dpr));if(element.width!==w||element.height!==h){element.width=w;element.height=h;}api.width=element.clientWidth;api.height=element.clientHeight;api.vp=vp;api.eye=eye;gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(program);gl.uniformMatrix4fv(u.VP,false,vp);gl.uniform3fv(u.Eye,eye);gl.uniform3fv(u.Light,[-1,0,0]);gl.uniform1f(u.Explain,explain);gl.uniform3fv(u.ToEarth,toEarth);gl.uniform4fv(u.Shadow,shadow?.parameters||[0,1.05,0,0]);gl.uniform3fv(u.ShadowOffset,shadow?.offset||[0,0,0]);gl.uniform3fv(u.Night,palette.night);gl.uniform3fv(u.Cloud,palette.cloud);gl.uniform4fv(u['Craters[0]'],craterValues);},
      sphere(p,size,kind,color,second,rot=0){positions(sphereBuffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.uniformMatrix4fv(u.Model,false,model(p,size,rot));gl.uniform1f(u.Kind,kind);gl.uniform1f(u.Alpha,1);gl.uniform3fv(u.Color,color);gl.uniform3fv(u.Second,second||color);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);},
      lines(points,color,loop=false,alpha=1){positions(lineBuffer,false);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.DYNAMIC_DRAW);gl.uniformMatrix4fv(u.Model,false,identity());gl.uniform1f(u.Kind,4);gl.uniform1f(u.Alpha,alpha);gl.uniform3fv(u.Color,color);gl.drawArrays(loop?gl.LINE_LOOP:gl.LINES,0,points.length/3);},
      triangles(points,color,alpha=.15){positions(lineBuffer,false);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.DYNAMIC_DRAW);gl.uniformMatrix4fv(u.Model,false,identity());gl.uniform1f(u.Kind,4);gl.uniform1f(u.Alpha,alpha);gl.uniform3fv(u.Color,color);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,points.length/3);gl.depthMask(true);},
      project(p){const m=api.vp,v=[...p,1],r=[0,0,0,0];for(let i=0;i<4;i++)for(let k=0;k<4;k++)r[i]+=m[k*4+i]*v[k];return {x:(r[0]/r[3]+1)*api.width/2,y:(1-r[1]/r[3])*api.height/2,visible:r[3]>0};},
      dispose(){gl.deleteProgram(program);[sphereBuffer,indexBuffer,lineBuffer].forEach(b=>gl.deleteBuffer(b));}};
    element.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;tween=null;q('[data-error]').hidden=false;q('[data-error]').textContent='3D 绘图中断，请重新打开此展示。';sync();});
    return api;
  }

  let world,observer,educator;
  try {world=Renderer(canvas);observer=Renderer(closeup);educator=Renderer(hemisphere);}catch(e){q('[data-error]').hidden=false;q('[data-error]').textContent=e.message;root.dataset.failed='true';play.disabled=true;return;}
  const orbit=[];
  for(let i=0;i<192;i++){const a=i/192*tau;orbit.push(radius*Math.cos(a),0,radius*Math.sin(a));}
  const grid=[];
  for(let n=-5;n<=5;n++){grid.push(n,-.06,-5,n,-.06,5,-5,-.06,n,5,-.06,n);}
  const ticks=[];
  for(let i=0;i<8;i++){const a=i/8*tau;const x=-radius*Math.cos(a),z=radius*Math.sin(a);ticks.push(x,-.08,z,x,.08,z);}
  function label(name,p){const el=q(`[data-label="${name}"]`),v=world.project(p);el.hidden=view==='earth'||!v.visible||v.x<26||v.x>world.width-26||v.y<36||v.y>world.height-30;el.style.left=v.x+'px';el.style.top=v.y+'px';}
  function render(){
    if(activeMode!=='phase')return;
    const moon=moonPosition(),rot=visualDay/cycle*tau+Math.PI/2,w=canvas.clientWidth,h=canvas.clientHeight;
    let eye,target,fov=.72;
    if(view==='earth'){eye=[0,0,0];target=moon;fov=.45;}
    else{target=[-1.45,0,0];const narrow=Math.max(1,1.35/(w/h)),d=distance*narrow;eye=view==='top'?[-1.45,.9999*d,.01*d]:[target[0]+d*Math.cos(elevation)*Math.sin(azimuth),d*Math.sin(elevation),d*Math.cos(elevation)*Math.cos(azimuth)];}
    world.begin(multiply(perspective(fov,w/h),lookAt(eye,target)),eye);
    if(view!=='earth'){
      world.lines(grid,palette.orbit,false,.16);
      world.lines(orbit,palette.orbit,true,.85);
      world.lines(ticks,palette.orbit,false,.9);
      const rays=[];[-4.8,4.8].forEach(z=>rays.push(-5.8,0,z,5,0,z,5,0,z,4.65,0,z-.14,5,0,z,4.65,0,z+.14));
      world.lines(rays,palette.ray,false,.55);

      world.sphere([-7.2,0,0],1.35,2,palette.sun,palette.hot);
      world.sphere([0,0,0],1.05,1,palette.earth,palette.land,visualDay/cycle*tau*3);
    }
    world.sphere(moon,.77,0,palette.moon,palette.moon,rot);
    const direction=unit(moon),person=direction.map(v=>v*1.13);
    if(view!=='earth'){
      world.sphere(person,.07,2,palette.sight,palette.sight);
      const u=unit(cross(direction,[0,1,0])),v=cross(u,direction),sight=[];
      const start=person,end=sub(moon,direction.map(x=>x*.77));sight.push(...start,...end);
      for(let i=0;i<4;i++){const a=i/4*tau,point=moon.map((x,k)=>x+.77*(u[k]*Math.cos(a)+v[k]*Math.sin(a)));sight.push(...start,...point);}
      world.lines(sight,palette.sight,false,.72);
    }
    label('observer',person.map((x,i)=>x+(i===1?.18:0)));
    label('sun',[-7.2,-1.65,0]);label('earth',[0,-1.34,0]);label('moon',[moon[0],-.99,moon[2]]);
    observer.begin(multiply(perspective(.435,closeup.clientWidth/closeup.clientHeight),lookAt([0,0,0],moon)),[0,0,0]);
    observer.sphere(moon,.77,0,palette.moon,palette.moon,rot);
    renderLesson(moon);
    root.dataset.angle=azimuth.toFixed(4);root.dataset.distance=distance.toFixed(3);root.dataset.view=view;root.dataset.visualDay=visualDay.toFixed(4);
    dirty=false;
  }

  function educationEye(toEarth){
    const ca=Math.cos(eduAzimuth),sa=Math.sin(eduAzimuth),ce=Math.cos(eduElevation);
    const outside=unit([(toEarth[0]*ca+toEarth[2]*sa)*ce,Math.sin(eduElevation),(-toEarth[0]*sa+toEarth[2]*ca)*ce]);
    let t=eduBlend;if(eduCameraTween){const k=Math.min(1,(performance.now()-eduCameraTween.start)/650),e=k*k*(3-2*k);t=eduCameraTween.from+(eduCameraTween.to-eduCameraTween.from)*e;eduBlend=t;if(k===1)eduCameraTween=null;}
    // Spherical interpolation preserves camera distance as the observer moves around the moon.
    const cosine=Math.max(-1,Math.min(1,dot(outside,toEarth))),angle=Math.acos(cosine);
    let d;if(t===1)d=toEarth;else if(angle<.001)d=outside;else if(cosine<-.999){const axis=unit(cross(outside,[0,1,0]));d=outside.map((x,i)=>x*Math.cos(Math.PI*t)+axis[i]*Math.sin(Math.PI*t));}else{const denom=Math.sin(angle);d=outside.map((x,i)=>(x*Math.sin((1-t)*angle)+toEarth[i]*Math.sin(t*angle))/denom);}
    return unit(d).map(x=>x*7);
  }
  function renderLesson(moon){
    const toEarth=unit(moon.map(x=>-x)),eye=educationEye(toEarth),w=hemisphere.clientWidth,h=hemisphere.clientHeight;
    educator.begin(multiply(orthographic(w/h),lookAt(eye,[0,0,0])),eye,lessonMode,toEarth);
    educator.sphere([0,0,0],1.18,0,palette.moon,palette.moon);
    const border=[],u=unit(cross(toEarth,[0,1,0])),v=cross(toEarth,u);
    for(let i=0;i<128;i++){const a=i/128*tau;border.push(...u.map((x,k)=>1.195*(x*Math.cos(a)+v[k]*Math.sin(a))));}
    if(lessonMode!==1)educator.lines(border,palette.sight,true,.9);
    const arrows=[];[-.62,0,.62].forEach(z=>arrows.push(-2.2,0,z,-1.35,0,z,-1.35,0,z,-1.52,0,z-.08,-1.35,0,z,-1.52,0,z+.08));
    if(!aligned)educator.lines(arrows,palette.ray,false,.8);
    const eyeMark=toEarth.map(x=>x*2.05);if(!aligned){educator.sphere(eyeMark,.10,2,palette.sight,palette.sight);educator.lines([...eyeMark,...toEarth.map(x=>x*1.24)],palette.sight,false,.8);}
    const earthLabel=educator.project(eyeMark),sunLabel=educator.project([-2.12,0,0]);
    for(const [el,p] of [[q('[data-edu-earth]'),{...earthLabel,y:earthLabel.y+8}],[q('[data-edu-sun]'),{...sunLabel,y:sunLabel.y-42}]]){el.hidden=!p.visible||p.x<12||p.x>w-12;el.style.left=Math.max(58,Math.min(w-70,p.x))+'px';el.style.top=Math.max(16,Math.min(h-24,p.y+17))+'px';}
    q('[data-edu-earth]').hidden=aligned||q('[data-edu-earth]').hidden;
    q('[data-edu-sun]').hidden=aligned||q('[data-edu-sun]').hidden;
    root.dataset.lesson=lessonMode;root.dataset.aligned=String(aligned);
    renderProjection();
  }
  let lastProjection='';
  function renderProjection(){
    const width=240,percent=Math.round((1-Math.cos(visualDay/cycle*tau))*50),key=visualDay.toFixed(3);
    if(lastProjection===key)return;lastProjection=key;projection.width=projection.height=width;
    const im=projectionContext.createImageData(width,width),a=visualDay/cycle*tau;
    for(let y=0;y<width;y++)for(let x=0;x<width;x++){const px=(x+.5-width/2)/(width*.45),py=(width/2-y-.5)/(width*.45),r2=px*px+py*py;if(r2>1)continue;const z=Math.sqrt(1-r2),light=px*Math.sin(a)-z*Math.cos(a),color=light>0?[245,237,158]:[41,163,194],j=(y*width+x)*4;im.data[j]=color[0];im.data[j+1]=color[1];im.data[j+2]=color[2];im.data[j+3]=255;}
    projectionContext.putImageData(im,0,0);text(q('[data-projected-light]'),percent+'%');
    let reason;if(percent===0)reason='受光半球在背面；我们看见的这一面几乎全暗。';else if(percent===100)reason='受光半球朝向地球；我们看见的圆盘几乎全亮。';else if(percent===50)reason='受光与可见的半球部分重叠；圆盘一半亮、一半暗。';else reason=percent<50?'只有少量受光区域朝向地球，投影成一弯月牙。':'大部分受光区域朝向地球，圆盘的亮区超过一半。';
    text(q('[data-projection-reason]'),reason);attr(projection,'aria-label',`地球视线下的圆盘投影，亮区占 ${percent}%，浅黄色为可见亮区，蓝色为可见暗区`);
  }

  // Quarter phases span a small observation window. They no longer flash for one frame.
  function phaseIndex(){const t=((day/cycle)%1+1)%1;const e=.012;
    if(t<e||t>1-e)return 0;if(Math.abs(t-.25)<e)return 2;if(Math.abs(t-.5)<e)return 4;if(Math.abs(t-.75)<e)return 6;
    return t<.25?1:t<.5?3:t<.75?5:7;
  }
  function name(){return phases[phaseIndex()];}
  function text(el,value){if(el.textContent!==value)el.textContent=value;}
  function attr(el,key,value){value=String(value);if(el.getAttribute(key)!==value)el.setAttribute(key,value);}
  const phaseButtons=[];
  // Each icon is an orthographic projection of a lit sphere, using the same sun geometry.
  function phaseIcon(i){const c=document.createElement('canvas');c.width=c.height=64;c.setAttribute('aria-hidden','true');const ctx=c.getContext('2d'),im=ctx.createImageData(64,64),a=i/8*tau;for(let y=0;y<64;y++)for(let x=0;x<64;x++){const px=(x+ .5-32)/28,py=(32-y-.5)/28,s=1-px*px-py*py;if(s<0)continue;const z=Math.sqrt(s),light=Math.max(0,px*Math.sin(a)-z*Math.cos(a)),j=(y*64+x)*4,b=light>0?100+155*Math.sqrt(light):34;im.data[j]=b;im.data[j+1]=b;im.data[j+2]=b+3;im.data[j+3]=255;}ctx.putImageData(im,0,0);return c;}
  phases.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='phase-button';b.dataset.phaseIndex=i;attr(b,'aria-pressed',false);b.append(phaseIcon(i));const label=document.createElement('span');label.textContent=p;b.append(label);b.addEventListener('click',()=>selectDay(cycle*i/8,true));q('.m3-presets').append(b);phaseButtons.push(b);});
  const views=Array.from(root.querySelectorAll('[data-view]')),turns=Array.from(root.querySelectorAll('[data-turn]'));
  function sync(){const percent=Math.round((1-Math.cos(day/cycle*tau))*50),index=phaseIndex();
    text(play,playing?'Ⅱ 暂停':'▶ 播放');attr(play,'aria-pressed',playing);speedSelect.value=String(speed);
    text(q('[data-phase]'),phases[index]);text(q('[data-light]'),percent+'%');text(q('[data-age]'),day.toFixed(1));text(q('[data-description]'),descriptions[index]);
    slider.value=day.toFixed(2);slider.style.setProperty('--progress',day/cycle*100+'%');attr(slider,'aria-valuetext',`${name()}，距新月 ${day.toFixed(1)} 天，照亮 ${percent}%`);
    phaseButtons.forEach((b,i)=>attr(b,'aria-pressed',i===index));views.forEach(b=>attr(b,'aria-pressed',b.dataset.view===view));turns.forEach(b=>b.disabled=view==='earth');
    attr(canvas,'aria-label',`${view==='earth'?'地球视角的月球':'可旋转的三维日地月场景'}，${name()}，照亮 ${percent}%`);attr(closeup,'aria-label',`地球上看到的${name()}，照亮 ${percent}%`);
    text(q('[data-hint]'),view==='earth'?'北半球标准月相朝向':'拖动旋转 · 滚轮 / 双指缩放');
    text(q('[data-view-title]'),view==='earth'?'地球上的观察视角':view==='top'?'俯视月球轨道':'日 · 地 · 月的空间关系');
    text(q('[data-status]'),playing?'动画播放中':tween?'正在切换':'已暂停 · 选择后保持当前月相');
    root.dataset.playing=String(playing);dirty=true;
  }
  function announce(){text(q('[data-announcement]'),`${name()}，距新月 ${day.toFixed(1)} 天，${playing?'播放中':'已暂停'}`);}
  function save(){try{localStorage.setItem('moon-lab-v3',JSON.stringify({day,speed,view,azimuth,elevation,distance}));}catch{}}
  function restore(){try{const p=JSON.parse(localStorage.getItem('moon-lab-v3'));if(!p||typeof p!=='object')return;
    if(Number.isFinite(p.day))day=Math.max(0,Math.min(cycle,p.day));speed=[.5,1,2].includes(p.speed)?p.speed:1;view=['orbit','earth','top'].includes(p.view)?p.view:'orbit';
    if(Number.isFinite(p.azimuth))azimuth=p.azimuth;if(Number.isFinite(p.elevation))elevation=Math.max(.12,Math.min(1.45,p.elevation));if(Number.isFinite(p.distance))distance=Math.max(9.5,Math.min(24,p.distance));visualDay=day;
  }catch{}}
  function selectDay(value,smooth=false){playing=false;previous=0;day=Math.max(0,Math.min(cycle,value));
    if(smooth&&!reduced.matches){let delta=day-visualDay;delta=((delta+cycle*1.5)%cycle)-cycle/2;tween={from:visualDay,delta,start:performance.now(),duration:560};}
    else{tween=null;visualDay=day;}
    sync();announce();save();
  }
  q('[data-align]').addEventListener('click',()=>{eduCameraTween=reduced.matches?null:{from:eduBlend,to:1,start:performance.now()};aligned=true;if(reduced.matches)eduBlend=1;attr(q('[data-align]'),'aria-pressed',true);lessonMode=3;syncLessonButtons();dirty=true;});
  q('[data-outside]').addEventListener('click',()=>{eduCameraTween=reduced.matches?null:{from:eduBlend,to:0,start:performance.now()};aligned=false;if(reduced.matches)eduBlend=0;attr(q('[data-align]'),'aria-pressed',false);dirty=true;});
  function syncLessonButtons(){root.querySelectorAll('[data-lesson]').forEach(b=>attr(b,'aria-pressed',Number(b.dataset.lesson)===lessonMode));root.classList.toggle('single-hemisphere',lessonMode!==3);}
  root.querySelectorAll('[data-lesson]').forEach(b=>b.addEventListener('click',()=>{lessonMode=Number(b.dataset.lesson);syncLessonButtons();dirty=true;}));
  root.querySelectorAll('[data-example]').forEach(b=>b.addEventListener('click',()=>{lessonMode=3;syncLessonButtons();selectDay(Number(b.dataset.example)*cycle,true);}));
  let eduPointer=null;hemisphere.addEventListener('pointerdown',e=>{hemisphere.setPointerCapture(e.pointerId);eduPointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
  hemisphere.addEventListener('pointermove',e=>{if(!eduPointer||e.pointerId!==eduPointer.id)return;aligned=false;eduCameraTween=null;eduBlend=0;attr(q('[data-align]'),'aria-pressed',false);eduAzimuth-=(e.clientX-eduPointer.x)*.009;eduElevation=Math.max(-1.3,Math.min(1.3,eduElevation+(e.clientY-eduPointer.y)*.009));eduPointer={id:e.pointerId,x:e.clientX,y:e.clientY};dirty=true;});
  hemisphere.addEventListener('pointerup',()=>eduPointer=null);hemisphere.addEventListener('pointercancel',()=>eduPointer=null);
  hemisphere.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();aligned=false;eduCameraTween=null;eduBlend=0;eduAzimuth+=(e.key==='ArrowLeft'?-.15:.15);attr(q('[data-align]'),'aria-pressed',false);dirty=true;});
  views.forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;sync();save();}));
  turns.forEach(b=>b.addEventListener('click',()=>{view='orbit';azimuth+=Number(b.dataset.turn)*.25;sync();save();}));
  q('[data-reset]').addEventListener('click',()=>{view='orbit';azimuth=.32;elevation=.64;distance=14.2;sync();save();});
  q('[data-zoom-in]').addEventListener('click',()=>{distance=Math.max(9.5,distance*.88);dirty=true;save();});
  q('[data-zoom-out]').addEventListener('click',()=>{distance=Math.min(24,distance/ .88);dirty=true;save();});
  play.addEventListener('click',()=>{if(tween){visualDay=day;tween=null;}playing=!playing;previous=0;sync();announce();save();});
  slider.addEventListener('input',()=>selectDay(Number(slider.value)));speedSelect.addEventListener('change',()=>{speed=Number(speedSelect.value);save();});
  const pointers=new Map();let oldPinch=0;
  canvas.addEventListener('pointerdown',e=>{if(view==='earth')return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});oldPinch=0;});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||view==='earth')return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1){if(view==='top'){view='orbit';elevation=1.3;}azimuth-=(e.clientX-old.x)*.006;elevation=Math.max(.12,Math.min(1.45,elevation+(e.clientY-old.y)*.006));}else{const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(oldPinch)distance=Math.max(9.5,Math.min(24,distance*oldPinch/Math.max(d,1)));oldPinch=d;}sync();});
  const end=e=>{pointers.delete(e.pointerId);oldPinch=0;save();};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  let zoomTimer;canvas.addEventListener('wheel',e=>{if(view==='earth')return;e.preventDefault();distance=Math.max(9.5,Math.min(24,distance*Math.exp(e.deltaY*.001)));dirty=true;clearTimeout(zoomTimer);zoomTimer=setTimeout(save,200);},{passive:false});
  canvas.addEventListener('keydown',e=>{if(view==='earth')return;const directions={ArrowLeft:-.15,ArrowRight:.15};if(e.key in directions){e.preventDefault();azimuth+=directions[e.key];dirty=true;save();}});
  const sizeObserver=new ResizeObserver(()=>dirty=true);sizeObserver.observe(canvas);sizeObserver.observe(closeup);sizeObserver.observe(hemisphere);
  reduced.addEventListener('change',e=>{if(e.matches){playing=false;tween=null;visualDay=day;sync();}});
  restore();sync();render();
  function animate(now){if(playing&&previous&&!document.hidden){day=(day+Math.min(now-previous,80)*cycle/36000*speed)%cycle;visualDay=day;sync();}
    if(tween){const t=Math.min(1,(now-tween.start)/tween.duration),ease=t*t*(3-2*t);visualDay=tween.from+tween.delta*ease;dirty=true;if(t===1){tween=null;visualDay=day;text(q('[data-status]'),'已暂停 · 选择后保持当前月相');}}
    if(activeMode==='eclipse')eclipse?.tick(now);
    previous=now;if(eduCameraTween)dirty=true;if(dirty)render();frameId=requestAnimationFrame(animate);
  }
  frameId=requestAnimationFrame(animate);
  window.addEventListener('pagehide',()=>{save();},{once:true});
  // Progressive enhancement: the ordinary webpage works without WebMCP support.
  const context=document.modelContext;if(context?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(context.registerTool({name:'set_moon_observation',title:'设置月相与观察视角',description:'设置距新月的天数，暂停动画，并可切换三维观察视角。',inputSchema:{type:'object',properties:{daysSinceNewMoon:{type:'number',minimum:0,maximum:29.5},view:{type:'string',enum:['orbit','earth','top']}},required:['daysSinceNewMoon'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){if(!input||!Number.isFinite(input.daysSinceNewMoon)||input.daysSinceNewMoon<0||input.daysSinceNewMoon>cycle||Object.keys(input).some(k=>!['daysSinceNewMoon','view'].includes(k))||(input.view!==undefined&&!['orbit','earth','top'].includes(input.view)))throw new TypeError('无效的月相天数或视角');activateMode('phase');selectDay(input.daysSinceNewMoon);if(input.view)view=input.view;sync();save();await new Promise(resolve=>requestAnimationFrame(resolve));return {daysSinceNewMoon:day,phase:name(),view,playing};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  function setupEclipse(){
    const eroot=q('#eclipse-demo'),eq=s=>eroot.querySelector(s),scene=eq('.eclipse-world'),portrait=eq('.eclipse-closeup');
    const earthR=1.05,moonR=.42,sunR=1.35,sunDistance=7.2,moonX=4.6,span=3.5;
    const slopeU=(sunR-earthR)/sunDistance,slopeP=(sunR+earthR)/sunDistance;
    const umbraR=earthR-slopeU*moonX,penumbraR=earthR+slopeP*moonX;
    const shadowParameters=[1,earthR,slopeU,slopeP];
    const scenarios={total:0,partial:.91,penumbral:1.45,none:3.2};
    let progress=0,offset=0,run=false,rate=1,cam='orbit',angle=.10,tilt=.48,zoom=14.2,redRays=true,needsDraw=true,lastTime=0,lastStage='';
    let space,moonView;
    try{space=Renderer(scene);moonView=Renderer(portrait);}catch(e){q('[data-error]').hidden=false;q('[data-error]').textContent='月食绘图无法启动：'+e.message;eq('[data-eclipse-play]').disabled=true;return {tick(){},pause(){},refresh(){}};}
    const progressSlider=eq('#eclipse-progress'),offsetSlider=eq('#eclipse-offset'),playE=eq('[data-eclipse-play]'),speedE=eq('#eclipse-speed');
    function stage(){const d=Math.hypot(offset,span*(1-2*progress)),e=.00001;return d+moonR<=umbraR+e?'total':d<=umbraR+moonR+e?'partial':d<=penumbraR+moonR+e?'penumbral':'none';}
    function scenario(){return offset+moonR<=umbraR?'total':offset<umbraR+moonR?'partial':offset<penumbraR+moonR?'penumbral':'none';}
    function coverage(){const r=umbraR,m=moonR,d=Math.hypot(offset,span*(1-2*progress));if(d>=r+m)return 0;if(d<=r-m)return 100;const a=Math.acos(Math.max(-1,Math.min(1,(d*d+r*r-m*m)/(2*d*r)))),b=Math.acos(Math.max(-1,Math.min(1,(d*d+m*m-r*r)/(2*d*m))));const lens=r*r*a+m*m*b-.5*Math.sqrt(Math.max(0,(-d+r+m)*(d+r-m)*(d-r+m)*(d+r+m)));return Math.round(lens/(Math.PI*m*m)*100);}
    function syncE(){const current=stage(),selected=scenario();
      const peak=Math.abs(progress-.5)<.005;
      const titles={none:progress<.5?'进入阴影前 · 正常满月':'离开阴影后 · 正常满月',penumbral:peak?'食甚 · 半影月食':progress<.5?'进入半影 · 月面变暗':'离开半影 · 月面变亮',partial:peak?'食甚 · 月偏食':progress<.5?'月偏食阶段 · 阴影扩大':'月偏食阶段 · 阴影缩小',total:peak?'食甚 · 月全食':'月全食阶段 · 暗红月球'};
      const descriptions={none:'月球没有进入地球阴影，太阳光仍能直接照到月面。',penumbral:'地球只挡住一部分照向月球的阳光。月面逐渐变暗，还没有进入本影。',partial:'月球的一部分进入本影，地球影子的圆弧边缘扫过月面。',total:'整个月球进入本影。直射阳光被挡住，穿过地球大气的微弱红橙光仍能到达月球。'};
      if(current==='none'&&selected==='none')titles.none='正常满月 · 避开地球阴影';
      text(eq('[data-eclipse-stage]'),titles[current]);text(eq('[data-eclipse-description]'),descriptions[current]);text(eq('[data-eclipse-coverage]'),coverage()+'%');
      text(playE,run?'Ⅱ 暂停月食':progress>=1?'↻ 重播月食':'▶ 播放月食');attr(playE,'aria-pressed',run);text(eq('[data-eclipse-status]'),run?'播放中':progress>=1?'演示结束 · 可以重播':'已暂停 · 拖动进程逐帧观察');
      progressSlider.value=progress.toFixed(3);progressSlider.style.setProperty('--progress',progress*100+'%');attr(progressSlider,'aria-valuetext',`进程 ${Math.round(progress*100)}%，${titles[current]}`);
      offsetSlider.value=String(offset);offsetSlider.style.setProperty('--progress',offset/3.4*100+'%');
      const labels={total:offset<.03?'穿过本影中心':'穿过本影，能够发生月全食',partial:'擦过本影，只发生月偏食',penumbral:'避开本影，只经过半影',none:'从阴影上方经过，不发生月食'};
      text(eq('[data-offset-label]'),labels[selected]);attr(offsetSlider,'aria-valuetext',labels[selected]);
      eroot.querySelectorAll('[data-eclipse-type]').forEach(b=>attr(b,'aria-pressed',b.dataset.eclipseType===selected));eroot.querySelectorAll('[data-eclipse-camera]').forEach(b=>attr(b,'aria-pressed',b.dataset.eclipseCamera===cam));
      attr(portrait,'aria-label',`${titles[current]}，本影覆盖月面圆盘约 ${coverage()}%`);
      eroot.dataset.stage=current;eroot.dataset.scenario=selected;eroot.dataset.progress=progress.toFixed(4);eroot.dataset.playing=String(run);
      if(lastStage!==current){lastStage=current;text(eq('[data-eclipse-announcement]'),titles[current]);}needsDraw=true;
    }
    function contact(threshold,outgoing){if(offset>threshold)return null;const z=Math.sqrt(Math.max(0,threshold*threshold-offset*offset));return (1+(outgoing?1:-1)*z/span)/2;}
    const contacts=[['初入半影',()=>contact(penumbraR+moonR,false)],['初亏',()=>contact(umbraR+moonR,false)],['食既',()=>contact(umbraR-moonR,false)],['食甚',()=>.5],['生光',()=>contact(umbraR-moonR,true)],['复圆',()=>contact(umbraR+moonR,true)],['复出半影',()=>contact(penumbraR+moonR,true)]];
    const contactButtons=contacts.map(([label,position])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className='eclipse-contact';b.addEventListener('click',()=>{const p=position();if(p===null)return;run=false;progress=Math.max(0,Math.min(1,p));syncE();});eq('.eclipse-contacts').append(b);return b;});
    function refreshContacts(){contacts.forEach(([label,pos],i)=>{contactButtons[i].disabled=pos()===null;contactButtons[i].title=pos()===null?'当前轨迹没有这个阶段':label;});}
    function conePoints(inner){const points=[],a=.03,b=7.2,n=96,ra=inner?earthR-slopeU*a:earthR+slopeP*a,rb=inner?earthR-slopeU*b:earthR+slopeP*b;for(let i=0;i<n;i++){const t=i/n*tau,k=(i+1)/n*tau,A=[a,ra*Math.cos(t),ra*Math.sin(t)],B=[b,rb*Math.cos(t),rb*Math.sin(t)],C=[a,ra*Math.cos(k),ra*Math.sin(k)],D=[b,rb*Math.cos(k),rb*Math.sin(k)];points.push(...A,...B,...C,...C,...B,...D);}return points;}
    const innerCone=conePoints(true),outerCone=conePoints(false);
    function coneEdges(inner){const points=[],end=7.2,r=inner?earthR-slopeU*end:earthR+slopeP*end;for(let i=0;i<8;i++){const a=i/8*tau;points.push(0,earthR*Math.cos(a),earthR*Math.sin(a),end,r*Math.cos(a),r*Math.sin(a));}return points;}
    const innerEdges=coneEdges(true),outerEdges=coneEdges(false);
    function tag(name,p){const el=eq(`[data-eclipse-label="${name}"]`),v=space.project(p);if(name==='umbra')text(el,space.width<650?'本影':'本影：直射阳光被完全挡住');if(name==='penumbra')text(el,space.width<650?'半影':'半影：部分阳光被挡住');el.hidden=!v.visible||v.x<20||v.x>space.width-20||v.y<22||v.y>space.height-22;const pad=el.getBoundingClientRect().width/2+8;el.style.left=Math.max(pad,Math.min(space.width-pad,v.x))+'px';el.style.top=v.y+'px';}
    function renderE(){if(activeMode!=='eclipse'||!scene.clientWidth||!portrait.clientWidth)return;
      const moon=[moonX,offset,span*(1-2*progress)],target=[-.25,.2,0],aspect=scene.clientWidth/scene.clientHeight,d=zoom*Math.max(1,1.75/aspect),eye=cam==='top'?[-.25,d,.01]:[target[0]+d*Math.cos(tilt)*Math.sin(angle),target[1]+d*Math.sin(tilt),d*Math.cos(tilt)*Math.cos(angle)];
      space.begin(multiply(perspective(.72,aspect),lookAt(eye,target)),eye,0,[1,0,0],{parameters:shadowParameters});
      space.triangles(outerCone,[.29,.40,.67],.085);space.triangles(innerCone,[.52,.16,.22],.19);space.lines(outerEdges,[.40,.52,.76],false,.2);space.lines(innerEdges,[.85,.34,.36],false,.45);
      space.lines([moonX,offset,-span,moonX,offset,span],palette.sight,false,.78);
      space.lines([-5.7,0,-3.8,7.4,0,-3.8,-5.7,0,3.8,7.4,0,3.8],palette.ray,false,.42);
      if(redRays){const rays=[];for(const sign of [-1,1]){const path=[[-6,sign*1.22,0],[-.55,sign*1.14,0],[0,sign*1.11,0],[.55,sign*1.03,0],[moonX,0,0]];for(let i=1;i<path.length;i++)rays.push(...path[i-1],...path[i]);}space.lines(rays,[.95,.34,.12],false,.78);}
      space.sphere([-sunDistance,0,0],sunR,2,palette.sun,palette.hot);space.sphere([0,0,0],earthR,1,palette.earth,palette.land,.2);space.sphere(moon,moonR,0,palette.moon,palette.moon,Math.PI*1.5);
      tag('sun',[-sunDistance,-1.6,0]);tag('earth',[0,-1.3,0]);tag('moon',[moonX,offset-.66,moon[2]]);tag('umbra',[6.4,.96,0]);tag('penumbra',[5.8,2.8,0]);
      const closeTarget=[moonX,0,0],a=portrait.clientWidth/portrait.clientHeight,y=moonR*1.23,x=y*a;const ortho=new Float32Array([1/x,0,0,0,0,1/y,0,0,0,0,-2/120,0,0,0,-1,1]);
      moonView.begin(multiply(ortho,lookAt([0,0,0],closeTarget)),[0,0,0],0,[1,0,0],{parameters:shadowParameters,offset:[0,offset,moon[2]]});moonView.sphere(closeTarget,moonR,0,palette.moon,palette.moon,Math.PI*1.5);
      eroot.dataset.angle=angle.toFixed(4);eroot.dataset.distance=zoom.toFixed(3);needsDraw=false;
    }
    eroot.querySelectorAll('[data-eclipse-type]').forEach(b=>b.addEventListener('click',()=>{offset=scenarios[b.dataset.eclipseType];progress=0;run=false;refreshContacts();syncE();}));
    eroot.querySelectorAll('[data-eclipse-camera]').forEach(b=>b.addEventListener('click',()=>{cam=b.dataset.eclipseCamera;syncE();}));
    progressSlider.addEventListener('input',()=>{progress=Number(progressSlider.value);run=false;syncE();});offsetSlider.addEventListener('input',()=>{offset=Number(offsetSlider.value);run=false;refreshContacts();syncE();});
    playE.addEventListener('click',()=>{if(progress>=1)progress=0;run=!run;lastTime=0;syncE();});speedE.addEventListener('change',()=>rate=Number(speedE.value));
    eq('[data-eclipse-reset]').addEventListener('click',()=>{cam='orbit';angle=.10;tilt=.48;zoom=14.2;syncE();});
    eroot.querySelectorAll('[data-eclipse-zoom]').forEach(b=>b.addEventListener('click',()=>{zoom=Math.max(10,Math.min(26,zoom*(b.dataset.eclipseZoom==='in'?.88:1/.88)));needsDraw=true;}));
    eq('[data-red-rays]').addEventListener('change',e=>{redRays=e.target.checked;needsDraw=true;});
    const fingers=new Map();let lastPinch=0;
    scene.addEventListener('pointerdown',e=>{scene.setPointerCapture(e.pointerId);fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastPinch=0;});scene.addEventListener('pointermove',e=>{if(!fingers.has(e.pointerId))return;const old=fingers.get(e.pointerId);fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(fingers.size===1){if(cam==='top'){cam='orbit';tilt=1.3;}angle-=(e.clientX-old.x)*.006;tilt=Math.max(.12,Math.min(1.4,tilt+(e.clientY-old.y)*.006));}else{const p=[...fingers.values()],pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(lastPinch)zoom=Math.max(10,Math.min(26,zoom*lastPinch/Math.max(1,pinch)));lastPinch=pinch;}syncE();});
    scene.addEventListener('pointerup',e=>{fingers.delete(e.pointerId);lastPinch=0;});scene.addEventListener('pointercancel',e=>{fingers.delete(e.pointerId);lastPinch=0;});scene.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(10,Math.min(26,zoom*Math.exp(e.deltaY*.001)));needsDraw=true;},{passive:false});scene.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();cam='orbit';angle+=(e.key==='ArrowLeft'?-.15:.15);syncE();});
    const resize=new ResizeObserver(()=>needsDraw=true);resize.observe(scene);resize.observe(portrait);
    reduced.addEventListener('change',e=>{if(e.matches){run=false;syncE();}});[scene,portrait].forEach(c=>c.addEventListener('webglcontextlost',()=>{run=false;syncE();}));
    refreshContacts();syncE();
    return {tick(now){if(run&&lastTime&&!document.hidden){progress=Math.min(1,progress+Math.min(now-lastTime,80)/24000*rate);if(progress===1)run=false;syncE();}lastTime=now;if(needsDraw)renderE();},pause(){run=false;lastTime=0;syncE();},refresh(){needsDraw=true;}};
  }
  function activateMode(mode,updateUrl=true){activeMode=mode==='eclipse'?'eclipse':'phase';playing=false;tween=null;visualDay=day;eduCameraTween=null;previous=0;eclipse?.pause();q('[data-phase-panel]').hidden=activeMode!=='phase';q('#eclipse-demo').hidden=activeMode!=='eclipse';root.querySelectorAll('[data-mode]').forEach(b=>attr(b,'aria-pressed',b.dataset.mode===activeMode));root.dataset.mode=activeMode;sync();eclipse?.refresh();dirty=true;if(updateUrl){try{history.replaceState(null,'','#'+activeMode);}catch{}}}
  eclipse=setupEclipse();root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>activateMode(b.dataset.mode)));window.addEventListener('hashchange',()=>activateMode(location.hash==='#eclipse'?'eclipse':'phase',false));activateMode(location.hash==='#eclipse'?'eclipse':'phase',false);

})();
