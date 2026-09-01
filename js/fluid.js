/* ═══ Alive — efeito de fluido reativo ao mouse (hero) ═══
   Simulação de fluido em WebGL (advecção + projeção de pressão),
   tingida nas cores da marca. Baseado na técnica clássica de
   fluid simulation (Stam), adaptada para rodar como fundo do hero. */

(function () {
  const canvas = document.getElementById('particles');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false })
    || canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return;

  const isWebGL2 = !!canvas.getContext('webgl2');
  let ext;
  if (isWebGL2) {
    gl.getExtension('EXT_color_buffer_float');
    ext = { formatRGBA: { internalFormat: gl.RGBA16F, format: gl.RGBA }, halfFloat: gl.HALF_FLOAT };
  } else {
    const hf = gl.getExtension('OES_texture_half_float');
    gl.getExtension('OES_texture_half_float_linear');
    ext = { formatRGBA: { internalFormat: gl.RGBA, format: gl.RGBA }, halfFloat: hf ? hf.HALF_FLOAT_OES : gl.UNSIGNED_BYTE };
  }
  if (!ext.halfFloat) return;

  const config = {
    SIM_RESOLUTION: 96,
    DYE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 0.955,
    VELOCITY_DISSIPATION: 0.98,
    PRESSURE_ITERATIONS: 18,
    CURL: 12,
    SPLAT_RADIUS: 0.2,
    SPLAT_FORCE: 3400,
  };

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  function program(vsSrc, fsSrc) {
    const p = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error('VS error', gl.getShaderInfoLog(vs), vsSrc);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error('FS error', gl.getShaderInfoLog(fs), fsSrc);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error('Link error', gl.getProgramInfoLog(p));
    return p;
  }
  function uniforms(p) {
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return u;
  }

  const head = isWebGL2 ? '#version 300 es\n' : '';
  const baseVertex = head + `
    precision highp float;
    ${isWebGL2 ? 'in' : 'attribute'} vec2 aPosition;
    ${isWebGL2 ? 'out' : 'varying'} vec2 vUv;
    ${isWebGL2 ? 'out' : 'varying'} vec2 vL;
    ${isWebGL2 ? 'out' : 'varying'} vec2 vR;
    ${isWebGL2 ? 'out' : 'varying'} vec2 vT;
    ${isWebGL2 ? 'out' : 'varying'} vec2 vB;
    uniform vec2 texelSize;
    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;
  function frag(body) {
    let src = head + 'precision highp float;precision highp sampler2D;\n';
    if (isWebGL2) {
      src += 'in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;\nout vec4 outColor;\n';
    } else {
      src += 'varying vec2 vUv, vL, vR, vT, vB;\n';
    }
    src += body;
    if (isWebGL2) {
      src = src.replace(/texture2D/g, 'texture');
      src = src.replace(/gl_FragColor/g, 'outColor');
    }
    return src;
  }

  const clearShader = program(baseVertex, frag(`
    uniform sampler2D uTexture; uniform float value;
    void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`));

  const splatShader = program(baseVertex, frag(`
    uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color;
    uniform vec2 point; uniform float radius;
    void main(){
      vec2 p = vUv - point; p.x *= aspectRatio;
      float d = exp(-dot(p,p)/radius);
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + d*color, 1.0);
    }`));

  const advectionShader = program(baseVertex, frag(`
    uniform sampler2D uVelocity; uniform sampler2D uSource;
    uniform vec2 texelSize; uniform float dt; uniform float dissipation;
    void main(){
      vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
      vec4 result = texture2D(uSource, coord);
      gl_FragColor = dissipation * result;
    }`));

  const divergenceShader = program(baseVertex, frag(`
    uniform sampler2D uVelocity;
    void main(){
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 c = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) L = -c.x; if (vR.x > 1.0) R = -c.x;
      if (vT.y > 1.0) T = -c.y; if (vB.y < 0.0) B = -c.y;
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }`));

  const curlShader = program(baseVertex, frag(`
    uniform sampler2D uVelocity;
    void main(){
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      float vort = R - L - T + B;
      gl_FragColor = vec4(0.5 * vort, 0.0, 0.0, 1.0);
    }`));

  const vorticityShader = program(baseVertex, frag(`
    uniform sampler2D uVelocity; uniform sampler2D uCurl;
    uniform float curl; uniform float dt;
    void main(){
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;
      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001; force *= curl * C;
      vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
      vel = clamp(vel, -1000.0, 1000.0);
      gl_FragColor = vec4(vel, 0.0, 1.0);
    }`));

  const pressureShader = program(baseVertex, frag(`
    uniform sampler2D uPressure; uniform sampler2D uDivergence;
    void main(){
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float div = texture2D(uDivergence, vUv).x;
      float p = (L + R + B + T - div) * 0.25;
      gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
    }`));

  const gradientSubtractShader = program(baseVertex, frag(`
    uniform sampler2D uPressure; uniform sampler2D uVelocity;
    void main(){
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 vel = texture2D(uVelocity, vUv).xy;
      vel -= vec2(R - L, T - B);
      gl_FragColor = vec4(vel, 0.0, 1.0);
    }`));

  const displayShader = program(baseVertex, frag(`
    uniform sampler2D uTexture;
    void main(){
      vec3 c = texture2D(uTexture, vUv).rgb;
      float a = clamp(max(c.r,max(c.g,c.b)) * 1.15, 0.0, 1.0);
      gl_FragColor = vec4(c, a);
    }`));

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  const quadIdx = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIdx);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function blit(target) {
    if (target === null) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture, fbo, width: w, height: h, attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; } };
  }
  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    let fbo1 = createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = createFBO(w, h, internalFormat, format, type, param);
    return {
      get read() { return fbo1; }, set read(v) { fbo1 = v; },
      get write() { return fbo2; }, set write(v) { fbo2 = v; },
      swap() { const t = fbo1; fbo1 = fbo2; fbo2 = t; },
    };
  }

  let dye, velocity, divergence, curlF, pressure;
  let simW, simH, dyeW, dyeH;

  function getResolution(res) {
    let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    const min = Math.round(res);
    const max = Math.round(res * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { width: max, height: min } : { width: min, height: max };
  }

  function initFBOs() {
    const s = getResolution(config.SIM_RESOLUTION);
    const d = getResolution(config.DYE_RESOLUTION);
    simW = s.width; simH = s.height; dyeW = d.width; dyeH = d.height;
    const { internalFormat, format } = ext.formatRGBA;
    const type = ext.halfFloat;
    const filter = isWebGL2 ? gl.LINEAR : gl.NEAREST;
    dye = createDoubleFBO(dyeW, dyeH, internalFormat, format, type, filter);
    velocity = createDoubleFBO(simW, simH, internalFormat, format, type, filter);
    divergence = createFBO(simW, simH, internalFormat, format, type, gl.NEAREST);
    curlF = createFBO(simW, simH, internalFormat, format, type, gl.NEAREST);
    pressure = createDoubleFBO(simW, simH, internalFormat, format, type, gl.NEAREST);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    initFBOs();
  }
  resize();
  addEventListener('resize', resize);

  // Paleta da marca: azul → ciano
  const palette = [
    [0.30, 0.55, 1.0],
    [0.22, 0.84, 1.0],
    [0.45, 0.62, 1.0],
  ];
  function pickColor() {
    const c = palette[Math.floor(Math.random() * palette.length)];
    return { r: c[0] * 0.9, g: c[1] * 0.9, b: c[2] * 0.9 };
  }

  const pointer = { x: 0, y: 0, dx: 0, dy: 0, down: false, moved: false };
  let lastX = null, lastY = null;

  function splat(x, y, dx, dy, color) {
    gl.useProgram(splatShader);
    const u = uniforms(splatShader);
    gl.uniform1i(u.uTarget, velocity.read.attach(0));
    gl.uniform1f(u.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(u.point, x, y);
    gl.uniform3f(u.color, dx, dy, 0.0);
    gl.uniform1f(u.radius, config.SPLAT_RADIUS / 100.0);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(u.uTarget, dye.read.attach(0));
    gl.uniform3f(u.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
  }

  function updatePointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = 1.0 - (clientY - rect.top) / rect.height;
    if (lastX === null) { lastX = x; lastY = y; return; }
    pointer.dx = (x - lastX) * config.SPLAT_FORCE;
    pointer.dy = (y - lastY) * config.SPLAT_FORCE;
    pointer.x = x; pointer.y = y;
    lastX = x; lastY = y;
    pointer.moved = Math.abs(pointer.dx) > 0.5 || Math.abs(pointer.dy) > 0.5;
  }

  const hero = document.getElementById('home') || canvas;
  hero.addEventListener('mousemove', e => updatePointer(e.clientX, e.clientY));
  hero.addEventListener('mouseleave', () => { lastX = null; lastY = null; });
  hero.addEventListener('touchmove', e => {
    if (e.touches[0]) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  let lastColorTime = 0;
  let lastFrame = performance.now();

  function step(dt) {
    gl.disable(gl.BLEND);

    gl.useProgram(curlShader);
    let u = uniforms(curlShader);
    gl.uniform2f(u.texelSize, 1.0 / simW, 1.0 / simH);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(curlF);

    gl.useProgram(vorticityShader);
    u = uniforms(vorticityShader);
    gl.uniform2f(u.texelSize, 1.0 / simW, 1.0 / simH);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uCurl, curlF.attach(1));
    gl.uniform1f(u.curl, config.CURL);
    gl.uniform1f(u.dt, dt);
    blit(velocity.write);
    velocity.swap();

    gl.useProgram(divergenceShader);
    u = uniforms(divergenceShader);
    gl.uniform2f(u.texelSize, 1.0 / simW, 1.0 / simH);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    gl.useProgram(clearShader);
    u = uniforms(clearShader);
    gl.uniform1i(u.uTexture, pressure.read.attach(0));
    gl.uniform1f(u.value, 0.8);
    blit(pressure.write);
    pressure.swap();

    gl.useProgram(pressureShader);
    u = uniforms(pressureShader);
    gl.uniform2f(u.texelSize, 1.0 / simW, 1.0 / simH);
    gl.uniform1i(u.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(u.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    gl.useProgram(gradientSubtractShader);
    u = uniforms(gradientSubtractShader);
    gl.uniform2f(u.texelSize, 1.0 / simW, 1.0 / simH);
    gl.uniform1i(u.uPressure, pressure.read.attach(0));
    gl.uniform1i(u.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    gl.useProgram(advectionShader);
    u = uniforms(advectionShader);
    gl.uniform2f(u.texelSize, 1.0 / simW, 1.0 / simH);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, velocity.read.attach(0));
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, config.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, dye.read.attach(1));
    gl.uniform1f(u.dissipation, config.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(displayShader);
    const u = uniforms(displayShader);
    gl.uniform1i(u.uTexture, dye.read.attach(0));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    blit(null);
  }

  function loop(now) {
    const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
    lastFrame = now;

    if (pointer.moved) {
      pointer.moved = false;
      splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pickColor());
    }

    step(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
