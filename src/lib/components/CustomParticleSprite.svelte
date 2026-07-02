<script>
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';

  let { url, position, floatY = 0, scale, opacity } = $props();

  let canvasEl = $state(null);
  let imgEl = $state(null);
  let animatedTexture = $state(null);

  $effect(() => {
    if (url && canvasEl) {
      const tex = new THREE.CanvasTexture(canvasEl);
      tex.colorSpace = THREE.SRGBColorSpace;
      animatedTexture = tex;
      return () => {
        tex.dispose();
        animatedTexture = null;
      };
    }
  });

  useTask(() => {
    if (url && imgEl && canvasEl && animatedTexture) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.drawImage(imgEl, 0, 0, canvasEl.width, canvasEl.height);
        animatedTexture.needsUpdate = true;
      }
    }
  });
</script>

{#if url}
  <T.Group position={position}>
    <T.Mesh 
      scale={[scale, scale, 1]}
      position={[0, floatY, 0]}
    >
      <T.PlaneGeometry args={[1, 1]} />
      <T.MeshBasicMaterial 
        map={animatedTexture}
        transparent={true} 
        alphaTest={0.05}
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </T.Mesh>
  </T.Group>
{/if}

<img 
  bind:this={imgEl}
  src={url}
  alt="hidden particle asset"
  style="position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0;"
/>
<canvas 
  bind:this={canvasEl}
  width={256}
  height={256}
  style="display: none;"
></canvas>
