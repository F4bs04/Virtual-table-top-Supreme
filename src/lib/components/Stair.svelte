<script>
  import { T } from '@threlte/core';
  import { networkState } from '../networkState.svelte.js';
  import { hexToWorld } from '../hexGeometry.js';
  import * as THREE from 'three';

  let { 
    id, 
    name, 
    x, // hexX start
    z, // hexZ start
    x2, // hexX end
    z2, // hexZ end
    y, // elevation Y start
    y2, // elevation Y end
    color = '#fbbf24' 
  } = $props();

  const isSelected = $derived(networkState.selectedPieceId === id);
  const floorHeight = 2.0;

  const p1 = $derived(hexToWorld(x, z));
  const p2 = $derived(hexToWorld(x2, z2));

  const dy = $derived((y2 ?? (y + floorHeight)) - y);
  const dx = $derived(p2.x - p1.x);
  const dz = $derived(p2.z - p1.z);

  const horizontalLength = $derived(Math.sqrt(dx * dx + dz * dz) || 0.1);
  const length = $derived(Math.sqrt(horizontalLength * horizontalLength + dy * dy));

  const angleY = $derived(Math.atan2(dx, dz));
  const angleX = $derived(Math.atan2(dy, horizontalLength));

  const centerX = $derived((p1.x + p2.x) / 2);
  const centerY = $derived((y + (y2 ?? (y + floorHeight))) / 2);
  const centerZ = $derived((p1.z + p2.z) / 2);

  const width = 1.2; // Width of the sloped stairs plane

  const objectFloor = $derived(Math.round(y / floorHeight) + 1);
  const isVisible = $derived(objectFloor <= networkState.currentViewLevel);

  // Generate procedural stair steps canvas texture
  let activeTexture = $state(null);
  let canvas = null;

  $effect(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 512;
    
    // Fill background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 512);

    // Draw horizontal stair treads (lines)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 10; i++) {
      const py = (i / 10) * 512;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(128, py);
      ctx.stroke();
    }

    // Side frame rails
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, 128, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    activeTexture = tex;

    return () => {
      tex.dispose();
    };
  });
</script>

<canvas bind:this={canvas} style="display: none;"></canvas>

<T.Group position={[centerX, centerY, centerZ]} rotation={[0, angleY, 0]} visible={isVisible}>
  {#if isSelected}
    <!-- Selection highlight outline box -->
    <T.Mesh rotation={[-Math.PI / 2 + angleX, 0, 0]}>
      <T.PlaneGeometry args={[width + 0.1, length + 0.1]} />
      <T.MeshBasicMaterial color="#06b6d4" wireframe side={THREE.DoubleSide} />
    </T.Mesh>
  {/if}

  <!-- Stair sloped ramp plane -->
  <T.Mesh 
    rotation={[-Math.PI / 2 + angleX, 0, 0]}
    onpointerdown={(e) => {
      e.stopPropagation();
      networkState.selectedPieceId = id;
      if (networkState.role === 'host' && networkState.gameState.buildMode) {
        if (networkState.activeTool === 'move') {
          networkState.draggedPieceId = id;
          networkState.addLog(`Selected stairs: ${name}. Drag to move.`);
        } else {
          networkState.addLog(`Selected stairs: ${name}. Select Move Tool to drag.`);
        }
      }
    }}
  >
    <T.PlaneGeometry args={[width, length]} />
    {#if activeTexture}
      <T.MeshBasicMaterial map={activeTexture} side={THREE.DoubleSide} transparent opacity={0.95} />
    {:else}
      <T.MeshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
    {/if}
  </T.Mesh>
</T.Group>
