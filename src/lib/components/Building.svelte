<script>
  import { T } from '@threlte/core';
  import { networkState } from '../networkState.svelte.js';
  import * as THREE from 'three';

  let {
    id,
    name,
    x, // world x
    y, // elevation/height y
    z, // world z
    hexX, // grid c
    hexZ, // grid r
    color,
    shape = 'box',
    width = 4,
    depth = 4,
    floors = 1,
    activeFloor = 1,
    height, // custom extrusion height
    isObstructing = false, // camera raycast occlusion state
    textureUrl = ''
  } = $props();

  let isHovered = $state(false);
  let activeTexture = $state(null);

  const isSelected = $derived(networkState.selectedPieceId === id);
  const floorHeight = 2.0; // floor level height step
  
  // Use custom height if provided, otherwise default to floors calculation
  const buildingHeight = $derived(typeof height === 'number' ? height : Math.max(0.65, floors * 0.65));

  // Load custom wall texture reactively
  $effect(() => {
    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(width, buildingHeight);
          activeTexture = tex;
        },
        undefined,
        (err) => {
          console.error("Error loading wall texture:", err);
          activeTexture = null;
        }
      );
    } else {
      activeTexture = null;
    }
  });

  // Reactively update texture repeat parameters when dimensions scale
  $effect(() => {
    if (activeTexture) {
      activeTexture.repeat.set(width, buildingHeight);
      activeTexture.needsUpdate = true;
    }
  });

  // Bounding box in hex coordinates
  const minHexX = $derived(hexX - (width - 1) / 2);
  const maxHexX = $derived(hexX + (width - 1) / 2);
  const minHexZ = $derived(hexZ - (depth - 1) / 2);
  const maxHexZ = $derived(hexZ + (depth - 1) / 2);

  // Check if any player character is inside this building's bounding box
  const isCharacterInside = $derived.by(() => {
    return Object.values(networkState.gameState.pieces).some(piece => {
      if (piece.class !== 'personagem') return false;
      return piece.x >= minHexX && piece.x <= maxHexX &&
             piece.z >= minHexZ && piece.z <= maxHexZ &&
             piece.y >= y && piece.y <= y + buildingHeight;
    });
  });

  // Backface culling when character is inside or it is obstructing, otherwise DoubleSide
  const wallMaterialSide = $derived((isCharacterInside || isObstructing) ? THREE.BackSide : THREE.DoubleSide);
  const wallOpacity = $derived(isHovered ? 0.95 : ((isCharacterInside || isObstructing) ? 0.25 : 0.82));

  // Show only if on the current view level
  // Floor N occupies Y range: (N-1)*floorHeight to N*floorHeight - epsilon
  const objectFloor = $derived(Math.round(y / floorHeight) + 1);
  const isVisible = $derived(objectFloor <= networkState.currentViewLevel);

  function handlePointerDown(e) {
    e.stopPropagation();
    networkState.selectedPieceId = id;

    if (networkState.role === 'host' && networkState.gameState.buildMode) {
      if (networkState.activeTool === 'move') {
        networkState.draggedPieceId = id;
        networkState.addLog(`Selected building: ${name}. Drag to reposition.`);
      } else {
        networkState.addLog(`Selected building: ${name}. Select the Move Tool (🎯 Move) in the toolbar to drag.`);
      }
    } else {
      networkState.addLog(`Selected building: ${name}. Build Mode required.`);
    }
  }
</script>

<T.Group position={[x, y, z]} visible={isVisible}>
  {#if isSelected}
    <T.Mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
      <T.RingGeometry args={[Math.max(width, depth) * 0.58, Math.max(width, depth) * 0.64, 48]} />
      <T.MeshBasicMaterial color="#22d3ee" side={THREE.DoubleSide} transparent opacity={0.75} />
    </T.Mesh>
  {/if}

  <!-- Main Extruded Wall Box -->
  <T.Mesh
    position={[0, buildingHeight / 2, 0]}
    onpointerdown={handlePointerDown}
    onpointerover={() => { isHovered = true; }}
    onpointerout={() => { isHovered = false; }}
    userData={{ structureId: id }}
  >
    <T.BoxGeometry args={[width, buildingHeight, depth]} />
    <T.MeshBasicMaterial 
      color={activeTexture ? '#ffffff' : color} 
      map={activeTexture}
      side={wallMaterialSide} 
      transparent 
      opacity={wallOpacity} 
    />
  </T.Mesh>
</T.Group>
