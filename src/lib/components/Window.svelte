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
    color = '#38bdf8', 
    height = 1.0, 
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

  // Since window starts elevated (y = baseHeight + 0.5), we derive floor level from y - 0.5
  const objectFloor = $derived(Math.round((y - 0.5) / floorHeight) + 1);
  const isVisible = $derived(objectFloor <= networkState.currentViewLevel);
</script>

<T.Group position={[centerX, y, centerZ]} rotation={[0, angle, 0]} visible={isVisible}>
  {#if isSelected}
    <T.Mesh position={[0, height / 2, 0]}>
      <T.BoxGeometry args={[thickness + 0.1, height + 0.1, length + 0.1]} />
      <T.MeshBasicMaterial color="#06b6d4" wireframe side={THREE.DoubleSide} />
    </T.Mesh>
  {/if}

  <!-- Outer Window Frame (Top/Bottom/Left/Right) -->
  <!-- Bottom Beam -->
  <T.Mesh position={[0, 0.05, 0]}>
    <T.BoxGeometry args={[thickness * 1.1, 0.1, length]} />
    <T.MeshBasicMaterial color="#1e293b" />
  </T.Mesh>
  <!-- Top Beam -->
  <T.Mesh position={[0, height - 0.05, 0]}>
    <T.BoxGeometry args={[thickness * 1.1, 0.1, length]} />
    <T.MeshBasicMaterial color="#1e293b" />
  </T.Mesh>
  <!-- Left Side -->
  <T.Mesh position={[0, height / 2, -length / 2 + 0.05]}>
    <T.BoxGeometry args={[thickness * 1.1, height, 0.1]} />
    <T.MeshBasicMaterial color="#1e293b" />
  </T.Mesh>
  <!-- Right Side -->
  <T.Mesh position={[0, height / 2, length / 2 - 0.05]}>
    <T.BoxGeometry args={[thickness * 1.1, height, 0.1]} />
    <T.MeshBasicMaterial color="#1e293b" />
  </T.Mesh>

  <!-- Glass Pane -->
  <T.Mesh 
    position={[0, height / 2, 0]}
    onpointerdown={(e) => {
      e.stopPropagation();
      networkState.selectedPieceId = id;
      if (networkState.role === 'host' && networkState.gameState.buildMode) {
        if (networkState.activeTool === 'move') {
          networkState.draggedPieceId = id;
          networkState.addLog(`Selected window: ${name}. Drag to move.`);
        } else {
          networkState.addLog(`Selected window: ${name}. Select Move Tool to drag.`);
        }
      }
    }}
  >
    <T.BoxGeometry args={[thickness * 0.3, height - 0.2, length - 0.2]} />
    <T.MeshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
  </T.Mesh>
</T.Group>
