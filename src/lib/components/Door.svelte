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
    y, // elevation Y
    color = '#b45309', 
    height = 2.0, 
    thickness = 0.15 
  } = $props();

  const isSelected = $derived(networkState.selectedPieceId === id);
  const floorHeight = 2.0;

  const p1 = $derived(hexToWorld(x, z));
  const p2 = $derived(hexToWorld(x2, z2));

  const dx = $derived(p2.x - p1.x);
  const dz = $derived(p2.z - p1.z);
  const length = $derived(Math.sqrt(dx * dx + dz * dz) || 0.1);
  const angle = $derived(Math.atan2(dx, dz));

  const centerX = $derived((p1.x + p2.x) / 2);
  const centerZ = $derived((p1.z + p2.z) / 2);

  const objectFloor = $derived(Math.round(y / floorHeight) + 1);
  const isVisible = $derived(objectFloor <= networkState.currentViewLevel);
</script>

<T.Group position={[centerX, y, centerZ]} rotation={[0, angle, 0]} visible={isVisible}>
  {#if isSelected}
    <T.Mesh position={[0, height / 2, 0]}>
      <T.BoxGeometry args={[thickness + 0.1, height + 0.1, length + 0.1]} />
      <T.MeshBasicMaterial color="#06b6d4" wireframe side={THREE.DoubleSide} />
    </T.Mesh>
  {/if}

  <!-- Left Frame Pole -->
  <T.Mesh position={[0, height / 2, -length / 2 + 0.05]}>
    <T.BoxGeometry args={[thickness * 1.2, height, 0.1]} />
    <T.MeshBasicMaterial color="#451a03" />
  </T.Mesh>

  <!-- Right Frame Pole -->
  <T.Mesh position={[0, height / 2, length / 2 - 0.05]}>
    <T.BoxGeometry args={[thickness * 1.2, height, 0.1]} />
    <T.MeshBasicMaterial color="#451a03" />
  </T.Mesh>

  <!-- Top Frame Beam -->
  <T.Mesh position={[0, height - 0.05, 0]}>
    <T.BoxGeometry args={[thickness * 1.2, 0.1, length]} />
    <T.MeshBasicMaterial color="#451a03" />
  </T.Mesh>

  <!-- Door Slab Panel -->
  <T.Mesh 
    position={[0, (height - 0.1) / 2, 0]}
    onpointerdown={(e) => {
      e.stopPropagation();
      networkState.selectedPieceId = id;
      if (networkState.role === 'host' && networkState.gameState.buildMode) {
        if (networkState.activeTool === 'move') {
          networkState.draggedPieceId = id;
          networkState.addLog(`Selected door: ${name}. Drag to move.`);
        } else {
          networkState.addLog(`Selected door: ${name}. Select Move Tool to drag.`);
        }
      }
    }}
  >
    <T.BoxGeometry args={[thickness * 0.6, height - 0.1, length - 0.2]} />
    <T.MeshBasicMaterial color={color} transparent opacity={0.8} />
  </T.Mesh>
</T.Group>
