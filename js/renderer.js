'use strict';
// Marrow House - a tiny PS1-style WebGL renderer.
// Renders the scene into a low resolution framebuffer with vertex snapping,
// affine texture mapping, gouraud point lights, a per-pixel flashlight and fog,
// then upscales it with 15-bit colour, ordered dithering, grain and scanlines.
(function (MH) {
  const MAXL = 8;

  const VS = `
precision highp float;
attribute vec3 a_pos; attribute vec3 a_nrm; attribute vec2 a_uv; attribute vec4 a_tile; attribute vec4 a_col;
uniform mat4 u_proj; uniform mat4 u_view; uniform mat4 u_model;
uniform vec2 u_snap; uniform vec3 u_amb;
uniform vec3 u_lp[${MAXL}]; uniform vec3 u_lc[${MAXL}]; uniform float u_lr[${MAXL}]; uniform vec4 u_lb[${MAXL}];
uniform vec4 u_tint;
varying vec2 v_uvA; varying float v_w; varying vec2 v_uvP; varying vec4 v_tile;
varying vec3 v_light; varying vec4 v_col; varying vec3 v_vpos; varying vec3 v_vnrm;
void main(){
  vec4 wp = u_model * vec4(a_pos, 1.0);
  vec3 wn = normalize((u_model * vec4(a_nrm, 0.0)).xyz + vec3(0.0, 0.00001, 0.0));
  vec3 L = u_amb;
  for (int i = 0; i < ${MAXL}; i++) {
    vec3 d = u_lp[i] - wp.xyz;
    float dist = length(d);
    float q = dist / max(u_lr[i], 0.001);
    float att = clamp(1.0 - q * q, 0.0, 1.0);
    att = att * sqrt(att);
    float ndl = clamp(dot(wn, d / max(dist, 0.0001)) * 0.8 + 0.2, 0.0, 1.0);
    vec4 b = u_lb[i];
    float inside = step(b.x, wp.x) * step(wp.x, b.z) * step(b.y, wp.z) * step(wp.z, b.w);
    L += u_lc[i] * att * ndl * inside;
  }
  v_light = L;
  vec4 vp = u_view * wp;
  v_vpos = vp.xyz;
  v_vnrm = (u_view * vec4(wn, 0.0)).xyz;
  vec4 clip = u_proj * vp;
  if (clip.w > 0.05) {
    vec2 ndc = clip.xy / clip.w;
    ndc = floor(ndc * u_snap + 0.5) / u_snap;
    clip.xy = ndc * clip.w;
  }
  v_uvP = a_uv; v_uvA = a_uv * clip.w; v_w = clip.w;
  v_tile = a_tile;
  v_col = vec4(a_col.rgb * u_tint.rgb, a_col.a + u_tint.a);
  gl_Position = clip;
}`;

  const FS = `
precision mediump float;
uniform sampler2D u_tex; uniform float u_affine;
uniform vec4 u_tileO; uniform float u_useTileO;
uniform vec3 u_fogCol; uniform vec2 u_fog;
uniform vec3 u_flPos; uniform vec3 u_flDir; uniform float u_flPow; uniform vec2 u_flCone; uniform vec3 u_flCol;
varying vec2 v_uvA; varying float v_w; varying vec2 v_uvP; varying vec4 v_tile;
varying vec3 v_light; varying vec4 v_col; varying vec3 v_vpos; varying vec3 v_vnrm;
void main(){
  vec2 uv = mix(v_uvP, v_uvA / v_w, u_affine);
  vec4 tile = mix(v_tile, u_tileO, u_useTileO);
  vec2 tuv = tile.xy + fract(uv) * tile.zw;
  vec4 tx = texture2D(u_tex, tuv);
  if (tx.a < 0.5) discard;
  vec3 base = tx.rgb * v_col.rgb;
  vec3 fd = v_vpos - u_flPos;
  float dist = length(fd);
  vec3 dir = fd / max(dist, 0.0001);
  float cosA = dot(dir, u_flDir);
  float cone = smoothstep(u_flCone.x, u_flCone.y, cosA);
  float spill = smoothstep(u_flCone.x - 0.3, u_flCone.x, cosA) * 0.16;
  float ndl = abs(dot(normalize(v_vnrm), dir));
  float att = 1.0 / (1.0 + 0.035 * dist * dist);
  float fl = (cone + spill) * att * (0.35 + 0.65 * ndl) * u_flPow;
  fl = floor(fl * 9.0 + 0.5) / 9.0;
  vec3 lit = base * (v_light + u_flCol * fl) + base * v_col.a;
  float fogF = clamp((length(v_vpos) - u_fog.x) / (u_fog.y - u_fog.x), 0.0, 1.0);
  gl_FragColor = vec4(mix(lit, u_fogCol, fogF), 1.0);
}`;

  const PVS = `
attribute vec2 a_p; varying vec2 v_uv;
void main(){ v_uv = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }`;

  const PFS = `
precision highp float;
uniform sampler2D u_scene; uniform vec2 u_res; uniform float u_time; uniform float u_fear;
uniform float u_fade; uniform vec3 u_flashCol; uniform float u_flash; uniform float u_scan;
uniform float u_scale; uniform float u_noise; uniform vec3 u_fadeCol;
varying vec2 v_uv;
float bayer2(vec2 p){ return mod(2.0 * p.x + 3.0 * p.y, 4.0); }
float bayer4(vec2 p){ return (4.0 * bayer2(mod(p, 2.0)) + bayer2(mod(floor(p / 2.0), 2.0))) / 16.0; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = v_uv;
  uv.x += sin(uv.y * 38.0 + u_time * 7.0) * 0.0025 * u_fear * u_fear;
  vec2 px = floor(uv * u_res);
  vec2 suv = (px + 0.5) / u_res;
  vec3 c;
  float o = (0.3 + 2.5 * u_fear) / u_res.x;
  c.r = texture2D(u_scene, suv + vec2(o, 0.0)).r;
  c.g = texture2D(u_scene, suv).g;
  c.b = texture2D(u_scene, suv - vec2(o, 0.0)).b;
  float n = hash(px + floor(u_time * 24.0) * 17.13) - 0.5;
  c += n * (0.035 + 0.18 * u_noise + 0.05 * u_fear);
  // rolling interference band when noisy
  float band = smoothstep(0.0, 0.04, abs(fract(v_uv.y * 0.7 - u_time * 0.35) - 0.5) - 0.02);
  c = mix(c * 0.65 + 0.06, c, mix(1.0, band, u_noise));
  c = pow(max(c, 0.0), vec3(0.88)) * 1.22;
  vec2 d = v_uv - 0.5;
  c *= 1.0 - dot(d, d) * (0.95 + 1.8 * u_fear);
  c = mix(c, u_flashCol, u_flash);
  c = mix(c, u_fadeCol, u_fade);
  float t = bayer4(px) - 0.5;
  c = floor(c * 31.0 + t + 0.5) / 31.0;
  if (u_scale >= 3.0 && mod(gl_FragCoord.y, u_scale) < 1.0) c *= 1.0 - 0.22 * u_scan;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const opts = { antialias: false, alpha: false, depth: true, preserveDrawingBuffer: true };
      const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('WebGL is not available in this browser.');
      this.gl = gl;
      this.sp = this._program(VS, FS);
      this.pp = this._program(PVS, PFS);
      this.su = this._uniforms(this.sp, [
        'u_proj', 'u_view', 'u_model', 'u_snap', 'u_amb', 'u_lp', 'u_lc', 'u_lr', 'u_lb', 'u_tint', 'u_tex',
        'u_affine', 'u_tileO', 'u_useTileO', 'u_fogCol', 'u_fog', 'u_flPos', 'u_flDir', 'u_flPow', 'u_flCone', 'u_flCol',
      ]);
      this.sa = {
        pos: gl.getAttribLocation(this.sp, 'a_pos'),
        nrm: gl.getAttribLocation(this.sp, 'a_nrm'),
        uv: gl.getAttribLocation(this.sp, 'a_uv'),
        tile: gl.getAttribLocation(this.sp, 'a_tile'),
        col: gl.getAttribLocation(this.sp, 'a_col'),
      };
      this.pu = this._uniforms(this.pp, [
        'u_scene', 'u_res', 'u_time', 'u_fear', 'u_fade', 'u_flashCol', 'u_flash', 'u_scan', 'u_scale', 'u_noise', 'u_fadeCol',
      ]);
      this.pa = gl.getAttribLocation(this.pp, 'a_p');
      this.triBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.triBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.identity = MH.M4.ident();
      this.fx = { time: 0, fear: 0, fade: 0, fadeCol: [0, 0, 0], flash: 0, flashCol: [1, 1, 1], scan: 1, noise: 0 };
      this.lp = new Float32Array(MAXL * 3);
      this.lc = new Float32Array(MAXL * 3);
      this.lr = new Float32Array(MAXL);
      this.lb = new Float32Array(MAXL * 4);
      this.resize();
    }

    _shader(type, src) {
      const gl = this.gl;
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error('Shader error: ' + gl.getShaderInfoLog(s));
      }
      return s;
    }
    _program(vs, fs) {
      const gl = this.gl;
      const p = gl.createProgram();
      gl.attachShader(p, this._shader(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, this._shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
      return p;
    }
    _uniforms(p, names) {
      const o = {};
      for (const n of names) o[n] = this.gl.getUniformLocation(p, n);
      return o;
    }

    resize() {
      const gl = this.gl;
      const w = Math.max(320, window.innerWidth), h = Math.max(240, window.innerHeight);
      const scale = Math.max(1, Math.round(h / 240));
      this.scale = scale;
      this.lowW = Math.floor(w / scale);
      this.lowH = Math.floor(h / scale);
      this.canvas.width = this.lowW * scale;
      this.canvas.height = this.lowH * scale;
      this.canvas.style.width = this.canvas.width + 'px';
      this.canvas.style.height = this.canvas.height + 'px';
      if (this.fbo) {
        gl.deleteFramebuffer(this.fbo);
        gl.deleteTexture(this.fboTex);
        gl.deleteRenderbuffer(this.fboDepth);
      }
      this.fboTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.lowW, this.lowH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.fboDepth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.fboDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.lowW, this.lowH);
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.fboDepth);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setAtlas(canvas) {
      const gl = this.gl;
      this.atlas = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    createMesh(data, dynamic) {
      const gl = this.gl;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const arr = data instanceof Float32Array ? data : new Float32Array(data);
      gl.bufferData(gl.ARRAY_BUFFER, arr, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      return { buf, count: arr.length / 16, dynamic: !!dynamic };
    }
    updateMesh(mesh, data) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
      const arr = data instanceof Float32Array ? data : new Float32Array(data);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      mesh.count = arr.length / 16;
    }
    deleteMesh(mesh) {
      if (mesh && mesh.buf) this.gl.deleteBuffer(mesh.buf);
    }

    // cam: {view, proj}; env: {fog, fogNear, fogFar, amb, affine}; fl: flashlight; lights: [{x,y,z,col,radius,bounds}]
    begin(cam, env, fl, lights) {
      const gl = this.gl, u = this.su;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, this.lowW, this.lowH);
      gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.useProgram(this.sp);
      gl.uniformMatrix4fv(u.u_proj, false, cam.proj);
      gl.uniformMatrix4fv(u.u_view, false, cam.view);
      gl.uniform2f(u.u_snap, this.lowW / 2, this.lowH / 2);
      gl.uniform3fv(u.u_amb, env.amb);
      gl.uniform3fv(u.u_fogCol, env.fog);
      gl.uniform2f(u.u_fog, env.fogNear, env.fogFar);
      gl.uniform1f(u.u_affine, env.affine == null ? 0.65 : env.affine);
      gl.uniform3fv(u.u_flPos, fl.pos);
      gl.uniform3fv(u.u_flDir, fl.dir);
      gl.uniform1f(u.u_flPow, fl.power);
      gl.uniform2f(u.u_flCone, fl.cosOuter, fl.cosInner);
      gl.uniform3fv(u.u_flCol, fl.col);
      this.lp.fill(0); this.lc.fill(0); this.lr.fill(0); this.lb.fill(0);
      for (let i = 0; i < Math.min(MAXL, lights.length); i++) {
        const L = lights[i];
        this.lp[i * 3] = L.x; this.lp[i * 3 + 1] = L.y; this.lp[i * 3 + 2] = L.z;
        this.lc[i * 3] = L.col[0] * L.intensity; this.lc[i * 3 + 1] = L.col[1] * L.intensity; this.lc[i * 3 + 2] = L.col[2] * L.intensity;
        this.lr[i] = L.radius;
        const b = L.bounds || [-1e5, -1e5, 1e5, 1e5];
        this.lb[i * 4] = b[0]; this.lb[i * 4 + 1] = b[1]; this.lb[i * 4 + 2] = b[2]; this.lb[i * 4 + 3] = b[3];
      }
      gl.uniform3fv(u.u_lp, this.lp);
      gl.uniform3fv(u.u_lc, this.lc);
      gl.uniform1fv(u.u_lr, this.lr);
      gl.uniform4fv(u.u_lb, this.lb);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.uniform1i(u.u_tex, 0);
      this._lastBuf = null;
    }

    draw(mesh, model, tint, tileO) {
      if (!mesh || !mesh.count) return;
      const gl = this.gl, u = this.su, a = this.sa;
      gl.uniformMatrix4fv(u.u_model, false, model || this.identity);
      const t = tint || [1, 1, 1, 0];
      gl.uniform4f(u.u_tint, t[0], t[1], t[2], t[3] || 0);
      if (tileO) {
        gl.uniform4fv(u.u_tileO, tileO);
        gl.uniform1f(u.u_useTileO, 1);
      } else gl.uniform1f(u.u_useTileO, 0);
      if (this._lastBuf !== mesh.buf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
        const st = 64;
        gl.enableVertexAttribArray(a.pos); gl.vertexAttribPointer(a.pos, 3, gl.FLOAT, false, st, 0);
        gl.enableVertexAttribArray(a.nrm); gl.vertexAttribPointer(a.nrm, 3, gl.FLOAT, false, st, 12);
        gl.enableVertexAttribArray(a.uv); gl.vertexAttribPointer(a.uv, 2, gl.FLOAT, false, st, 24);
        gl.enableVertexAttribArray(a.tile); gl.vertexAttribPointer(a.tile, 4, gl.FLOAT, false, st, 32);
        gl.enableVertexAttribArray(a.col); gl.vertexAttribPointer(a.col, 4, gl.FLOAT, false, st, 48);
        this._lastBuf = mesh.buf;
      }
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }

    end() {
      const gl = this.gl, u = this.pu, f = this.fx;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.pp);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
      gl.uniform1i(u.u_scene, 0);
      gl.uniform2f(u.u_res, this.lowW, this.lowH);
      gl.uniform1f(u.u_time, f.time);
      gl.uniform1f(u.u_fear, f.fear);
      gl.uniform1f(u.u_fade, f.fade);
      gl.uniform3fv(u.u_fadeCol, f.fadeCol);
      gl.uniform3fv(u.u_flashCol, f.flashCol);
      gl.uniform1f(u.u_flash, f.flash);
      gl.uniform1f(u.u_scan, f.scan);
      gl.uniform1f(u.u_scale, this.scale);
      gl.uniform1f(u.u_noise, f.noise);
      // disable scene attributes that might be enabled
      for (const k in this.sa) if (this.sa[k] >= 0) gl.disableVertexAttribArray(this.sa[k]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.triBuf);
      gl.enableVertexAttribArray(this.pa);
      gl.vertexAttribPointer(this.pa, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(this.pa);
      this._lastBuf = null;
    }
  }
  MH.Renderer = Renderer;

  // ---------------- Mesh builder ----------------
  const WHITE = [1, 1, 1, 0];
  class MeshBuilder {
    constructor() {
      this.a = [];
      this.tx = 0; this.tz = 0; this.ty = 0; this.c = 1; this.s = 0;
    }
    // quarter turns rotation + translation for subsequent geometry
    setTransform(x, y, z, rot) {
      this.tx = x; this.ty = y; this.tz = z;
      const ang = (rot || 0) * Math.PI / 2;
      this.c = Math.round(Math.cos(ang)); this.s = Math.round(Math.sin(ang));
      if (rot && rot % 1 !== 0) { this.c = Math.cos(ang); this.s = Math.sin(ang); }
    }
    resetTransform() { this.setTransform(0, 0, 0, 0); }
    v(x, y, z, nx, ny, nz, u, vv, t, c) {
      const C = this.c, S = this.s;
      const wx = C * x + S * z + this.tx, wz = -S * x + C * z + this.tz;
      const wnx = C * nx + S * nz, wnz = -S * nx + C * nz;
      this.a.push(wx, y + this.ty, wz, wnx, ny, wnz, u, vv, t[0], t[1], t[2], t[3], c[0], c[1], c[2], c.length > 3 ? c[3] : 0);
    }
    quad(p0, p1, p2, p3, n, uv, t, c) {
      c = c || WHITE;
      this.v(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv[0], uv[1], t, c);
      this.v(p1[0], p1[1], p1[2], n[0], n[1], n[2], uv[2], uv[3], t, c);
      this.v(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv[4], uv[5], t, c);
      this.v(p0[0], p0[1], p0[2], n[0], n[1], n[2], uv[0], uv[1], t, c);
      this.v(p2[0], p2[1], p2[2], n[0], n[1], n[2], uv[4], uv[5], t, c);
      this.v(p3[0], p3[1], p3[2], n[0], n[1], n[2], uv[6], uv[7], t, c);
    }
    // Axis aligned box. tex: tile rect or {top,bottom,side,front,back}. uvs: 0 = fit per face, number = metres per repeat
    box(x0, y0, z0, x1, y1, z1, tex, col, uvs, skip) {
      const T = (k) => (tex && tex.length === 4 ? tex : (tex[k] || tex.side || tex.top));
      const s = uvs || 0;
      const U = (a, b) => (s ? [a / s, b / s] : null);
      const fit = [0, 1, 1, 1, 1, 0, 0, 0];
      const face = (key, p0, p1, p2, p3, n, uv) => {
        if (skip && skip.indexOf(key) >= 0) return;
        this.quad(p0, p1, p2, p3, n, uv || fit, T(key), col);
      };
      const w = x1 - x0, h = y1 - y0, d = z1 - z0;
      // +z (front)
      face('front', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1],
        s ? [x0 / s, h / s, x1 / s, h / s, x1 / s, 0, x0 / s, 0] : null);
      // -z (back)
      face('back', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1],
        s ? [x1 / s, h / s, x0 / s, h / s, x0 / s, 0, x1 / s, 0] : null);
      // +x
      face('right', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0],
        s ? [z1 / s, h / s, z0 / s, h / s, z0 / s, 0, z1 / s, 0] : null);
      // -x
      face('left', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0],
        s ? [z0 / s, h / s, z1 / s, h / s, z1 / s, 0, z0 / s, 0] : null);
      // +y
      face('top', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0],
        s ? [x0 / s, z1 / s, x1 / s, z1 / s, x1 / s, z0 / s, x0 / s, z0 / s] : null);
      // -y
      face('bottom', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0],
        s ? [x0 / s, z0 / s, x1 / s, z0 / s, x1 / s, z1 / s, x0 / s, z1 / s] : null);
      void w; void d; void U;
    }
    // Vertical quad facing +z (in local space) centred at x,z. For signs/pictures on walls.
    panel(cx, y0, cz, w, h, tex, col, facing) {
      // facing: 0 = +z, 1 = +x, 2 = -z, 3 = -x (in local space)
      const hw = w / 2;
      const f = facing || 0;
      let p0, p1, p2, p3, n;
      if (f === 0) { p0 = [cx - hw, y0, cz]; p1 = [cx + hw, y0, cz]; p2 = [cx + hw, y0 + h, cz]; p3 = [cx - hw, y0 + h, cz]; n = [0, 0, 1]; }
      else if (f === 2) { p0 = [cx + hw, y0, cz]; p1 = [cx - hw, y0, cz]; p2 = [cx - hw, y0 + h, cz]; p3 = [cx + hw, y0 + h, cz]; n = [0, 0, -1]; }
      else if (f === 1) { p0 = [cx, y0, cz + hw]; p1 = [cx, y0, cz - hw]; p2 = [cx, y0 + h, cz - hw]; p3 = [cx, y0 + h, cz + hw]; n = [1, 0, 0]; }
      else { p0 = [cx, y0, cz - hw]; p1 = [cx, y0, cz + hw]; p2 = [cx, y0 + h, cz + hw]; p3 = [cx, y0 + h, cz - hw]; n = [-1, 0, 0]; }
      this.quad(p0, p1, p2, p3, n, [0, 1, 1, 1, 1, 0, 0, 0], tex, col);
    }
    // flat quad on the floor
    floorQuad(cx, y, cz, w, d, tex, col, rot) {
      const hw = w / 2, hd = d / 2;
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      const P = (x, z) => [cx + c * x + s * z, y, cz - s * x + c * z];
      this.quad(P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd), [0, 1, 0], [0, 1, 1, 1, 1, 0, 0, 0], tex, col);
    }
    // two crossed vertical quads (sprites like trees, weeds). flip = hang from the top
    cross(cx, y0, cz, w, h, tex, col, rot, flip) {
      const r = rot || 0;
      const uv = flip ? [0, 0, 1, 0, 1, 1, 0, 1] : [0, 1, 1, 1, 1, 0, 0, 0];
      for (let k = 0; k < 2; k++) {
        const a = r + k * Math.PI / 2;
        const dx = Math.cos(a) * w / 2, dz = -Math.sin(a) * w / 2;
        const n = [Math.sin(a), 0, Math.cos(a)];
        this.quad([cx - dx, y0, cz - dz], [cx + dx, y0, cz + dz], [cx + dx, y0 + h, cz + dz], [cx - dx, y0 + h, cz - dz], n,
          uv, tex, col);
      }
    }
    // oriented box: unit cube [-0.5,0.5]^3 transformed by matrix m (local space)
    obox(m, tex, col) {
      const P = (x, y, z) => MH.M4.point(m, x, y, z);
      const N = (x, y, z) => {
        const r = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
        const l = Math.hypot(r[0], r[1], r[2]) || 1;
        return [r[0] / l, r[1] / l, r[2] / l];
      };
      const fit = [0, 1, 1, 1, 1, 0, 0, 0];
      const h = 0.5;
      this.quad(P(-h, -h, h), P(h, -h, h), P(h, h, h), P(-h, h, h), N(0, 0, 1), fit, tex, col);
      this.quad(P(h, -h, -h), P(-h, -h, -h), P(-h, h, -h), P(h, h, -h), N(0, 0, -1), fit, tex, col);
      this.quad(P(h, -h, h), P(h, -h, -h), P(h, h, -h), P(h, h, h), N(1, 0, 0), fit, tex, col);
      this.quad(P(-h, -h, -h), P(-h, -h, h), P(-h, h, h), P(-h, h, -h), N(-1, 0, 0), fit, tex, col);
      this.quad(P(-h, h, h), P(h, h, h), P(h, h, -h), P(-h, h, -h), N(0, 1, 0), fit, tex, col);
      this.quad(P(-h, -h, -h), P(h, -h, -h), P(h, -h, h), P(-h, -h, h), N(0, -1, 0), fit, tex, col);
    }
    data() { return new Float32Array(this.a); }
    static unitCube() {
      const mb = new MeshBuilder();
      mb.box(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, [0, 0, 1, 1], WHITE, 0);
      return mb.data();
    }
    static unitQuad() {
      // vertical quad facing +z, centred at origin, 1x1
      const mb = new MeshBuilder();
      mb.quad([-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0], [0, 0, 1], [0, 1, 1, 1, 1, 0, 0, 0], [0, 0, 1, 1], WHITE);
      return mb.data();
    }
  }
  MH.MeshBuilder = MeshBuilder;
})(window.MH);
