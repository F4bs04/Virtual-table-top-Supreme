<script>
  import { T } from '@threlte/core';
  import { networkState } from '../networkState.svelte.js';
  import { hexToWorld } from '../hexGeometry.js';
  import * as THREE from 'three';
  import { untrack, onDestroy } from 'svelte';

  let {
    id,
    name,
    x, // hexX start
    z, // hexZ start
    x2, // hexX end
    z2, // hexZ end
    y, // elevation Y
    color = '#64748b',
    height = 2.0,
    thickness = 0.15,
    openings = [],
    isObstructing = false,
    textureUrl = '',
    textureRepeat = 1
  } = $props();

  let activeTexture = $state(null);
  let matRef = $state(null);
  let isHovered = $state(false);

  const isSelected = $derived(networkState.selectedPieceId === id);
  const floorHeight = 2.0;

  // Convert start and end hex coordinates to world positions
  const p1 = $derived(hexToWorld(x, z));
  const p2 = $derived(hexToWorld(x2, z2));

  // Compute wall transform properties
  const dx = $derived(p2.x - p1.x);
  const dz = $derived(p2.z - p1.z);
  const length = $derived(Math.sqrt(dx * dx + dz * dz) || 0.1);
  const angle = $derived(Math.atan2(dx, dz));

  const centerX = $derived((p1.x + p2.x) / 2);
  const centerZ = $derived((p1.z + p2.z) / 2);

  // Dynamic geometry generation with openings (holes)
  let geometry = $state(null);

  function applyBoxUV(geom) {
    geom.computeBoundingBox();
    const pos = geom.attributes.position;
    const norm = geom.attributes.normal;
    if (!pos || !norm) return;
    const uvArray = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const nz = Math.abs(norm.getZ(i));
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let u, v;
      if (ny > nx && ny > nz) {
        u = x; v = z;
      } else if (nx > ny && nx > nz) {
        u = z; v = y;
      } else {
        u = x; v = y;
      }
      uvArray[i * 2] = u;
      uvArray[i * 2 + 1] = v;
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
  }

  // Rebuild geometry when dimensions or openings change
  $effect(() => {
    const currentLength = length;
    const currentHeight = height;
    const currentThickness = thickness;
    const currentOpenings = openings;

    if (currentLength < 0.05) return;

    untrack(() => {
      const shape = new THREE.Shape();
      const halfL = currentLength / 2;
      shape.moveTo(-halfL, 0);
      shape.lineTo(halfL, 0);
      shape.lineTo(halfL, currentHeight);
      shape.lineTo(-halfL, currentHeight);
      shape.closePath();

      if (currentOpenings && currentOpenings.length > 0) {
        currentOpenings.forEach(op => {
          const localX = (op.position * currentLength) - halfL;
          const halfW = op.width / 2;
          const xMin = localX - halfW;
          const xMax = localX + halfW;
          const yMin = op.yOffset || 0;
          const yMax = yMin + op.height;

          const holePath = new THREE.Path();
          holePath.moveTo(xMin, yMin);
          holePath.lineTo(xMax, yMin);
          holePath.lineTo(xMax, yMax);
          holePath.lineTo(xMin, yMax);
          holePath.closePath();
          shape.holes.push(holePath);
        });
      }

      const oldGeom = geometry;
      const newGeom = new THREE.ExtrudeGeometry(shape, {
        depth: currentThickness,
        bevelEnabled: false
      });
      newGeom.translate(0, 0, -currentThickness / 2);
      applyBoxUV(newGeom);
      
      geometry = newGeom;

      if (oldGeom) {
        oldGeom.dispose();
      }
    });
  });

  onDestroy(() => {
    if (geometry) geometry.dispose();
    if (activeTexture) activeTexture.dispose();
  });

  // Load texture reactively — re-runs when textureUrl changes
  $effect(() => {
    if (textureUrl) {
      activeTexture = null;
      const loader = new THREE.TextureLoader();
      const capturedRepeat = Number(textureRepeat) || 1;
      const capturedLength = length;
      const capturedHeight = height;
      loader.load(
        textureUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(capturedLength * capturedRepeat, capturedHeight * capturedRepeat);
          tex.needsUpdate = true;
          activeTexture = tex;
        },
        undefined,
        (err) => {
          console.error('[WallLine] Error loading texture:', err);
          activeTexture = null;
        }
      );
    } else {
      activeTexture = null;
    }
  });

  // Apply texture/color to material — runs whenever matRef OR activeTexture changes
  $effect(() => {
    const mat = matRef;
    const tex = activeTexture;
    if (!mat) return;
    if (tex) {
      mat.map = tex;
      mat.color.set('#ffffff');
    } else {
      mat.map = null;
      mat.color.set(color);
    }
    mat.needsUpdate = true;
  });

  // Reactively update texture tiling when dimensions or repeat changes
  $effect(() => {
    const tex = activeTexture;
    if (!tex) return;
    const rep = Number(textureRepeat) || 1;
    tex.repeat.set(length * rep, height * rep);
    tex.needsUpdate = true;
  });

  const objectFloor = $derived(Math.round(y / floorHeight) + 1);
  const opacityMultiplier = $derived.by(() => {
    const diff = networkState.currentViewLevel - objectFloor;
    if (diff === 0) return 1.0;                             // current floor: fully visible
    if (diff > 0) return 0.35;                              // floor below: ghost (always)
    // floor above: only visible in Build Mode as a structural reference ghost
    return networkState.gameState.buildMode ? 0.15 : 0.0;
  });
  const isVisible = $derived(opacityMultiplier > 0.01);
  const wallOpacity = $derived((isHovered ? 0.95 : (isObstructing ? 0.08 : 0.88)) * opacityMultiplier);
  const wallMaterialSide = THREE.DoubleSide;

  function handlePointerDown(e) {
    e.stopPropagation();
    networkState.selectedPieceId = id;
    if (networkState.role === 'host' && networkState.gameState.buildMode) {
      if (networkState.activeTool === 'move') {
        networkState.draggedPieceId = id;
        networkState.addLog(`Selected wall line: ${name}. Drag to move.`);
      } else {
        networkState.addLog(`Selected wall line: ${name}. Select the Move Tool (🎯 Move) in the toolbar to drag.`);
      }
    }
  }
</script>

<T.Group position={[centerX, y, centerZ]} rotation={[0, angle, 0]} visible={isVisible}>
  {#if isSelected}
    <!-- Selection highlight box -->
    <T.Mesh position={[0, height / 2, 0]}>
      <T.BoxGeometry args={[thickness + 0.08, height + 0.05, length + 0.08]} />
      <T.MeshBasicMaterial color="#06b6d4" wireframe side={THREE.DoubleSide} transparent opacity={opacityMultiplier} />
    </T.Mesh>
  {/if}

  <!-- Wall Custom Extruded Mesh with Holes -->
  {#if geometry}
    <T.Mesh
      rotation={[0, Math.PI / 2, 0]}
      onpointerdown={handlePointerDown}
      onpointerover={() => { isHovered = true; }}
      onpointerout={() => { isHovered = false; }}
      userData={{ structureId: id }}
      {geometry}
    >
      <T.MeshBasicMaterial
        bind:ref={matRef}
        color={activeTexture ? '#ffffff' : color}
        map={activeTexture}
        side={wallMaterialSide}
        transparent
        opacity={wallOpacity}
      />
    </T.Mesh>
  {/if}

  <!-- Render Door/Window Sub-meshes inside cut-out holes -->
  {#each (openings || []) as op (op.id)}
    {@const localZ = length / 2 - (op.position * length)}
    {#if op.type === 'door'}
      <T.Group position={[0, op.yOffset || 0, localZ]}>
        <!-- Left Frame Pole -->
        <T.Mesh position={[0, op.height / 2, -op.width / 2 + 0.03]}>
          <T.BoxGeometry args={[thickness * 1.2, op.height, 0.06]} />
          <T.MeshBasicMaterial color="#451a03" transparent={opacityMultiplier < 0.99} opacity={opacityMultiplier} />
        </T.Mesh>
        <!-- Right Frame Pole -->
        <T.Mesh position={[0, op.height / 2, op.width / 2 - 0.03]}>
          <T.BoxGeometry args={[thickness * 1.2, op.height, 0.06]} />
          <T.MeshBasicMaterial color="#451a03" transparent={opacityMultiplier < 0.99} opacity={opacityMultiplier} />
        </T.Mesh>
        <!-- Top Frame Beam -->
        <T.Mesh position={[0, op.height - 0.03, 0]}>
          <T.BoxGeometry args={[thickness * 1.2, 0.06, op.width]} />
          <T.MeshBasicMaterial color="#451a03" transparent={opacityMultiplier < 0.99} opacity={opacityMultiplier} />
        </T.Mesh>
        <!-- Door Panel (Swing openable around left hinge) -->
        {@const angleY = op.isOpen ? Math.PI / 2.2 : 0}
        {@const doorX = op.isOpen ? (op.width / 2) * Math.sin(Math.PI / 2.2) : 0}
        {@const doorZ = op.isOpen ? -op.width / 2 + (op.width / 2) * Math.cos(Math.PI / 2.2) : 0}
        <T.Mesh 
          position={[doorX, op.height / 2, doorZ]}
          rotation={[0, angleY, 0]}
          onpointerdown={(e) => {
            e.stopPropagation();
            networkState.toggleWallOpening(id, op.id);
          }}
        >
          <T.BoxGeometry args={[thickness * 0.5, op.height - 0.06, op.width - 0.08]} />
          <T.MeshBasicMaterial color={op.isOpen ? "#f59e0b" : "#b45309"} transparent opacity={0.85 * opacityMultiplier} />
        </T.Mesh>
      </T.Group>
    {:else if op.type === 'window'}
      <T.Group position={[0, op.yOffset || 0, localZ]}>
        <!-- Frame Outline -->
        <T.Mesh position={[0, 0.03, 0]}>
          <T.BoxGeometry args={[thickness * 1.1, 0.06, op.width]} />
          <T.MeshBasicMaterial color="#1e293b" transparent={opacityMultiplier < 0.99} opacity={opacityMultiplier} />
        </T.Mesh>
        <T.Mesh position={[0, op.height - 0.03, 0]}>
          <T.BoxGeometry args={[thickness * 1.1, 0.06, op.width]} />
          <T.MeshBasicMaterial color="#1e293b" transparent={opacityMultiplier < 0.99} opacity={opacityMultiplier} />
        </T.Mesh>
        <T.Mesh position={[0, op.height / 2, -op.width / 2 + 0.03]}>
          <T.BoxGeometry args={[thickness * 1.1, op.height, 0.06]} />
          <T.MeshBasicMaterial color="#1e293b" transparent={opacityMultiplier < 0.99} opacity={opacityMultiplier} />
        </T.Mesh>
        <T.Mesh position={[0, op.height / 2, op.width / 2 - 0.03]}>
          <T.BoxGeometry args={[thickness * 1.1, op.height, 0.06]} />
          <T.MeshBasicMaterial color="#1e293b" transparent={opacityMultiplier < 0.99} opacity={opacityMultiplier} />
        </T.Mesh>
        <!-- Window Glass -->
        <T.Mesh position={[0, op.height / 2, 0]}>
          <T.BoxGeometry args={[thickness * 0.3, op.height - 0.06, op.width - 0.06]} />
          <T.MeshBasicMaterial color="#38bdf8" transparent opacity={0.4 * opacityMultiplier} />
        </T.Mesh>
      </T.Group>
    {/if}
  {/each}
</T.Group>
