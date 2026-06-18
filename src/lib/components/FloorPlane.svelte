<script>
  import { T } from '@threlte/core';
  import { networkState } from '../networkState.svelte.js';
  import { hexToWorld } from '../hexGeometry.js';
  import * as THREE from 'three';
  import { untrack, onDestroy } from 'svelte';

  let {
    id,
    name,
    x,
    y,
    z,
    width = 4,
    depth = 4,
    color = '#a855f7',
    textureUrl = '',
    textureRepeat = 1,
    points = null
  } = $props();

  const bounds = $derived.by(() => {
    if (!points || points.length === 0) return { minX: 0, maxX: 4, minZ: 0, maxZ: 4, width: 4, depth: 4 };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    points.forEach(p => {
      const w = hexToWorld(p.c, p.r);
      if (w.x < minX) minX = w.x;
      if (w.x > maxX) maxX = w.x;
      if (w.z < minZ) minZ = w.z;
      if (w.z > maxZ) maxZ = w.z;
    });
    return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
  });

  let activeTexture = $state(null);
  let isHovered = $state(false);
  const isSelected = $derived(networkState.selectedPieceId === id);

  $effect(() => {
    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          const rep = Number(textureRepeat) || 1;
          tex.repeat.set((width / 2) * rep, (depth / 2) * rep);
          activeTexture = tex;
        },
        undefined,
        (err) => {
          console.error("Error loading floor plane texture:", err);
          activeTexture = null;
        }
      );
    } else {
      activeTexture = null;
    }
  });

  // Update texture repeat reactively when width or depth changes
  $effect(() => {
    if (activeTexture) {
      const w = points ? bounds.width : width;
      const d = points ? bounds.depth : depth;
      const rep = Number(textureRepeat) || 1;
      activeTexture.repeat.set((w / 2) * rep, (d / 2) * rep);
      activeTexture.needsUpdate = true;
    }
  });

  let geometry = $state(null);

  $effect(() => {
    const currentPoints = points;
    if (!currentPoints || currentPoints.length < 3) return;

    untrack(() => {
      const shape = new THREE.Shape();
      const firstW = hexToWorld(currentPoints[0].c, currentPoints[0].r);
      shape.moveTo(firstW.x, -firstW.z);
      
      for (let i = 1; i < currentPoints.length; i++) {
        const w = hexToWorld(currentPoints[i].c, currentPoints[i].r);
        shape.lineTo(w.x, -w.z);
      }
      shape.closePath();

      const oldGeom = geometry;
      const newGeom = new THREE.ExtrudeGeometry(shape, {
        depth: 0.05,
        bevelEnabled: false
      });
      
      geometry = newGeom;
      if (oldGeom) oldGeom.dispose();
    });
  });

  onDestroy(() => {
    if (geometry) geometry.dispose();
  });

  const planeLevel = $derived(Math.round(y / 2.0) + 1);
  const opacityMultiplier = $derived.by(() => {
    const diff = networkState.currentViewLevel - planeLevel;
    if (diff === 0) return 1.0;
    if (diff > 0) return 0.35;
    return 0.0;
  });
  const isPlaneVisible = $derived(opacityMultiplier > 0.05);
  const isGridVisible = $derived(networkState.currentViewLevel === planeLevel);

  function handlePointerDown(e) {
    e.stopPropagation();
    networkState.selectedPieceId = id;
    if (networkState.role === 'host' && networkState.gameState.buildMode) {
      if (networkState.activeTool === 'move') {
        networkState.draggedPieceId = id;
        networkState.addLog(`Selected floor plane: ${name}. Drag to move.`);
      } else {
        networkState.addLog(`Selected floor plane: ${name}. Select the Move Tool (🎯 Move) in the toolbar to drag.`);
      }
    } else {
      networkState.addLog(`Selected floor plane: ${name}. Build Mode required.`);
    }
  }
</script>

<T.Group position={points ? [0, y, 0] : [x, y, z]} visible={isPlaneVisible}>
  <!-- Highlight selection outline -->
  {#if isSelected}
    {#if points}
      {#if geometry}
        <T.Mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} {geometry}>
          <T.MeshBasicMaterial color="#06b6d4" wireframe side={THREE.DoubleSide} transparent opacity={opacityMultiplier} />
        </T.Mesh>
      {/if}
    {:else}
      <T.Mesh position={[width / 2, 0.01, depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <T.PlaneGeometry args={[width + 0.15, depth + 0.15]} />
        <T.MeshBasicMaterial color="#06b6d4" wireframe side={THREE.DoubleSide} />
      </T.Mesh>
    {/if}
  {/if}

  <!-- Flat elevated floor plane -->
  {#if !points || geometry}
    <T.Mesh 
      position={points ? [0, 0.002, 0] : [width / 2, 0.002, depth / 2]} 
      rotation={[-Math.PI / 2, 0, 0]}
      onpointerdown={handlePointerDown}
      onpointerover={() => { isHovered = true; }}
      onpointerout={() => { isHovered = false; }}
      geometry={points ? geometry : undefined}
    >
      {#if !points}
        <T.PlaneGeometry args={[width, depth]} />
      {/if}
      {#if activeTexture}
        <T.MeshBasicMaterial map={activeTexture} color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.85 * opacityMultiplier} />
      {:else}
        <T.MeshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.65 * opacityMultiplier} />
      {/if}
    </T.Mesh>
  {/if}

  <!-- Platform local Grid overlay -->
  {#if isGridVisible && !points}
    <T.GridHelper 
      args={[Math.round(Math.max(width, depth)), Math.round(Math.max(width, depth)), '#06b6d4', 'rgba(6, 182, 212, 0.45)']} 
      position={[width / 2, 0.005, depth / 2]} 
    />
  {/if}
</T.Group>
