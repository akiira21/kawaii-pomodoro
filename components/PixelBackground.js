'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import PixelFallback from './PixelFallback';
import { drawScenery } from './pixelScenery';
import { W, H, buildFragment } from './pixelShaders';

// Vertex shader: just a full-screen quad.
const VERTEX_SHADER = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// three.js + GLSL animated pixel backgrounds.
//
//   * A 320x180 WebGLRenderer draws one full-screen quad with a THREE.ShaderMaterial.
//   * The FRAGMENT SHADER for each theme lives in ./pixelShaders.js (buildFragment) - it draws the
//     sky, wind, grass, flowers, petals, fireflies, water... all driven by the `u_t` time uniform.
//   * The static scenery (hills, trunk, ground) is drawn once on a 2D canvas and passed in as
//     two THREE.CanvasTextures (`u_back`, `u_sway`).
//   * CSS scales the small canvas up with `image-rendering: pixelated`, so it stays crisp pixel art.
export default function PixelBackground({ theme }) {
  const ref = useRef();
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (fallback) return;
    const canvas = ref.current;
    // Users with "reduce motion" on get slower motion, never a frozen page.
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speed = calm ? 0.35 : 1;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
    } catch (e) { setFallback(true); return; }
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);     // false = leave the CSS size alone (full-screen, cover)

    const { back, sway } = drawScenery(theme);
    const mkTexture = (img) => {
      const t = new THREE.CanvasTexture(img);
      t.flipY = false;                 // shader samples with a top-left origin
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    };
    const uniforms = {
      u_t: { value: 0 },
      u_back: { value: mkTexture(back) },
      u_sway: { value: mkTexture(sway) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: buildFragment(theme),
      depthTest: false,
      depthWrite: false,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);

    // compile now so a broken shader falls back instead of showing a blank page
    renderer.compile(scene, camera);
    const bad = renderer.info.programs?.some((p) => p.diagnostics && p.diagnostics.runnable === false);
    if (bad) { console.warn('[PixelBackground] shader failed to compile, using 2D fallback'); renderer.dispose(); setFallback(true); return; }

    let time = 8, last = performance.now();
    renderer.setAnimationLoop((now) => {
      time += Math.min((now - last) / 1000, 0.1) * speed;   // clamp: a hidden tab can't cause a time jump
      last = now;
      uniforms.u_t.value = time;                          // <- this is what animates everything
      renderer.render(scene, camera);
    });

    const onLost = (e) => { e.preventDefault(); setFallback(true); };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => {
      renderer.setAnimationLoop(null);
      canvas.removeEventListener('webglcontextlost', onLost);
      uniforms.u_back.value.dispose();
      uniforms.u_sway.value.dispose();
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [theme, fallback]);

  if (fallback) return <PixelFallback theme={theme} />;
  return <canvas ref={ref} className="bg pixel-base" width={W} height={H} aria-hidden="true" />;
}
