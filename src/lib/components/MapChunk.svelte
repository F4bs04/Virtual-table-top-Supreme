<script>
  import { T } from '@threlte/core';
  import { CanvasTexture, DoubleSide } from 'three';
  import { networkState } from '../networkState.svelte.js';

  // Read props in Svelte 5
  let { row, col, chunkSize = 4 } = $props();

  let canvas = $state(null);
  let texture = $state(null);

  // Position calculation
  // We place the chunk such that the grid spans in positive x and z direction
  const xPos = $derived(col * chunkSize + chunkSize / 2);
  const zPos = $derived(row * chunkSize + chunkSize / 2);

  // Generate a procedural, premium spiritual texture for each map chunk
  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 512;
    canvas.width = size;
    canvas.height = size;

    // Read theme reactively
    const theme = networkState.gameState.theme || 'soul-society';

    let baseCore, baseBorder, gridColor, borderColor, runeColor, dashColor, textColor, textSubColor;

    if (theme === 'hueco-mundo') {
      baseCore = '#07161b'; // Desert void
      baseBorder = '#020709'; // Near black
      gridColor = 'rgba(6, 182, 212, 0.15)'; // Teal grids
      borderColor = 'rgba(148, 163, 184, 0.35)'; // Silver-white border
      runeColor = 'rgba(34, 211, 238, 0.25)'; // Bright teal
      dashColor = 'rgba(148, 163, 184, 0.15)';
      textColor = '#94a3b8'; // Silver
      textSubColor = 'rgba(6, 182, 212, 0.8)';
    } else if (theme === 'karakura-town') {
      baseCore = '#1c0c02'; // Sunset amber core
      baseBorder = '#0d0400'; // Dark crimson edge
      gridColor = 'rgba(249, 115, 22, 0.15)'; // Orange grids
      borderColor = 'rgba(239, 68, 68, 0.35)'; // Warm red border
      runeColor = 'rgba(249, 115, 22, 0.25)'; // Glowing orange
      dashColor = 'rgba(239, 68, 68, 0.15)';
      textColor = '#f97316'; // Orange text
      textSubColor = 'rgba(239, 68, 68, 0.8)';
    } else { // 'soul-society'
      baseCore = '#120b24'; // Deep purple core
      baseBorder = '#080512'; // Pitch black border
      gridColor = 'rgba(168, 85, 247, 0.15)'; // Purple grids
      borderColor = 'rgba(6, 182, 212, 0.35)'; // Cyan borders for chunks
      runeColor = 'rgba(168, 85, 247, 0.25)'; // Lavender
      dashColor = 'rgba(6, 182, 212, 0.15)';
      textColor = '#22d3ee'; // Neon cyan
      textSubColor = 'rgba(168, 85, 247, 0.8)';
    }

    // 1. Base background (Deep spiritual void)
    const grad = ctx.createRadialGradient(size/2, size/2, 10, size/2, size/2, size);
    grad.addColorStop(0, baseCore);
    grad.addColorStop(1, baseBorder);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);


    // 3. Highlighted border
    ctx.lineWidth = 6;
    ctx.strokeStyle = borderColor;
    ctx.strokeRect(0, 0, size, size);

    // 4. Spiritual markings (Reiatsu Circle / Seal)
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/3.5, 0, Math.PI * 2);
    ctx.strokeStyle = runeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(size/2, size/2, size/3.2, 0, Math.PI * 2);
    ctx.strokeStyle = dashColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // 5. Text information: Chunk coordinates
    ctx.fillStyle = textColor;
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SECTOR [${col}, ${row}]`, size / 2, size / 2 - 20);

    ctx.fillStyle = textSubColor;
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('AETHELGARD SOUL GRID', size / 2, size / 2 + 20);

    // Generate texture
    const tex = new CanvasTexture(canvas);
    tex.needsUpdate = true;
    texture = tex;

    return () => {
      tex.dispose();
    };
  });

  let meshRef = $state(null);
  $effect(() => {
    if (meshRef && (xPos !== undefined || zPos !== undefined)) {
      meshRef.updateMatrix();
      meshRef.updateMatrixWorld(true);
      if (meshRef.geometry) {
        meshRef.geometry.computeBoundingSphere();
        meshRef.geometry.computeBoundingBox();
      }
    }
  });
</script>

<!-- Hidden canvas for generating the procedural texture -->
<canvas bind:this={canvas} style="display: none;"></canvas>

<!-- Three.js mesh for the ground chunk -->
{#if texture}
  {#key chunkSize}
    <T.Mesh 
      bind:ref={meshRef}
      position={[xPos, -0.01, zPos]} 
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
    >
      <T.PlaneGeometry args={[chunkSize, chunkSize]} />
      <T.MeshBasicMaterial 
        map={texture} 
        side={DoubleSide} 
        transparent={true}
        opacity={0.65}
      />
    </T.Mesh>
  {/key}
{/if}
