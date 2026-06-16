<script>
  import { T, useThrelte, useTask } from '@threlte/core';
  import { OrbitControls, interactivity } from '@threlte/extras';
  import { onMount } from 'svelte';
  import { networkState } from '../networkState.svelte.js';
  import { hexToWorld, worldToHex, getHexDistance } from '../hexGeometry.js';
  import MapChunk from './MapChunk.svelte';
  import Piece from './Piece.svelte';
  import Building from './Building.svelte';
  import FloorPlane from './FloorPlane.svelte';
  import WallLine from './WallLine.svelte';
  import Door from './Door.svelte';
  import Window from './Window.svelte';
  import Stair from './Stair.svelte';
  import SplatBackground from './SplatBackground.svelte';
  import * as THREE from 'three';

  // Initialize Threlte interactivity plugin inside Canvas hierarchy
  interactivity();

  // Grid dimensions. Larger maps use larger chunks to keep draw calls low.
  const gridSize = $derived(networkState.gameState.gridSize || 24);
  const chunkSize = $derived.by(() => {
    if (gridSize >= 32 && gridSize % 8 === 0) return 8;
    if (gridSize >= 36 && gridSize % 6 === 0) return 6;
    return 4;
  });
  const chunksCount = $derived(Math.ceil(gridSize / chunkSize));
  const maxZoomDistance = $derived(Math.max(32, gridSize * 2));

  let cameraRef = $state(null);
  let controlsRef = $state(null);
  let lastGridSize = $state(0);
  const zMax = $derived(gridSize * Math.sqrt(3) / 2);

  $effect(() => {
    if (gridSize && cameraRef && controlsRef) {
      if (gridSize !== lastGridSize) {
        lastGridSize = gridSize;
        const posX = gridSize / 2;
        const posY = Math.max(14, gridSize * 0.62);
        const posZ = zMax * 1.12;

        cameraRef.position.set(posX, posY, posZ);
        controlsRef.target.set(posX, 0, zMax / 2);
        controlsRef.update();
      }
    }
  });

  // Generate coordinate lists for chunk indexing reactively
  const chunkIndices = $derived.by(() => {
    const indices = [];
    const count = chunksCount;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        indices.push({ row: r, col: c });
      }
    }
    return indices;
  });

  // Theme-derived lighting colors
  const ambientColor = $derived.by(() => {
    const theme = networkState.gameState.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#0f1d24'; // Cold cyan
    if (theme === 'karakura-town') return '#24120a'; // Warm sunset orange/amber
    return '#1e1b4b'; // Deep purple-blue
  });

  const ambientIntensity = $derived.by(() => {
    const theme = networkState.gameState.theme || 'soul-society';
    if (theme === 'hueco-mundo') return 1.8;
    if (theme === 'karakura-town') return 1.6;
    return 1.5;
  });

  const directionalColor = $derived.by(() => {
    const theme = networkState.gameState.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#ccfbf1'; // Light cyan-blue
    if (theme === 'karakura-town') return '#ffedd5'; // Light orange-yellow
    return '#e0f2fe'; // Light sky blue
  });

  const gridColor = $derived.by(() => {
    const theme = networkState.gameState.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#06b6d4'; // Teal
    if (theme === 'karakura-town') return '#f97316'; // Orange
    return '#a855f7'; // Purple
  });

  // Hex grid line segments calculation
  const hexGridPoints = $derived.by(() => {
    const pts = [];
    const R = 1.0 / Math.sqrt(3);

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const { x: cx, z: cz } = hexToWorld(c, r);
        const verts = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i + Math.PI / 6;
          verts.push(new THREE.Vector3(cx + R * Math.cos(angle), 0.005, cz + R * Math.sin(angle)));
        }
        for (let i = 0; i < 6; i++) {
          pts.push(verts[i], verts[(i + 1) % 6]);
        }
      }
    }
    return pts;
  });

  // Basic plane size derivations
  const basicPlaneSizeSetting = $derived(networkState.gameState.basicPlaneSize || 'medium');
  const basicPlaneMultiplier = $derived.by(() => {
    if (basicPlaneSizeSetting === 'small') return 1.5;
    if (basicPlaneSizeSetting === 'large') return 6.0;
    return 3.0; // medium
  });
  const basicPlaneWidth = $derived(gridSize * basicPlaneMultiplier);
  const basicPlaneDepth = $derived(zMax * basicPlaneMultiplier);

  const basicPlaneColor = $derived.by(() => {
    const theme = networkState.gameState.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#07161b';
    if (theme === 'karakura-town') return '#1c0c02';
    return '#120b24'; // soul-society
  });

  let bufferGeometry = $state(null);
  $effect(() => {
    if (bufferGeometry && hexGridPoints.length > 0) {
      bufferGeometry.setFromPoints(hexGridPoints);
      bufferGeometry.computeBoundingSphere();
      bufferGeometry.computeBoundingBox();
    }
  });

  let frameTime = $state(Date.now());
  useTask(() => {
    frameTime = Date.now();
  });

  // Hover state
  let hoveredHex = $state(null); // { c, r }

  const selectedPiece = $derived(networkState.selectedPieceId ? networkState.gameState.pieces[networkState.selectedPieceId] : null);
  const movementHexes = $derived.by(() => {
    if (!selectedPiece || selectedPiece.class !== 'personagem') return [];
    const neighbors = [];
    const cs = selectedPiece.x;
    const rs = selectedPiece.z;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const tc = cs + dc;
        const tr = rs + dr;
        if (tc >= 0 && tc < gridSize && tr >= 0 && tr < gridSize) {
          if (getHexDistance(cs, rs, tc, tr) === 1) {
            neighbors.push({ c: tc, r: tr });
          }
        }
      }
    }
    return neighbors;
  });

  // Background map texture loader
  let backgroundTexture = $state(null);
  $effect(() => {
    const bgUrl = networkState.gameState.backgroundImage;
    if (bgUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(bgUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        backgroundTexture = tex;
      }, undefined, (err) => {
        console.error("Error loading background texture:", err);
        backgroundTexture = null;
      });
    } else {
      backgroundTexture = null;
    }
  });
  // Derived world positions of player character tokens
  const charactersWorldPositions = $derived.by(() => {
    return Object.values(networkState.gameState.pieces)
      .filter(p => p.class === 'personagem')
      .map(p => {
        const wp = hexToWorld(p.x, p.z);
        // Position on active floor level or sloped stair Y
        const pieceY = networkState.getPieceRenderHeight(p);
        return {
          id: p.id,
          pos: new THREE.Vector3(wp.x, pieceY + 0.6, wp.z)
        };
      });
  });

  const { scene, camera } = useThrelte();
  const raycaster = new THREE.Raycaster();

  // Sims-style cut-away transparency effect
  useTask(() => {
    const activeCamera = camera.current;
    if (!activeCamera) return;

    // Collect all wall meshes in the scene
    const walls = [];
    scene.traverse((obj) => {
      if (obj.isMesh && obj.userData && obj.userData.structureId) {
        walls.push(obj);
      }
    });

    if (walls.length === 0 || charactersWorldPositions.length === 0) {
      if (networkState.obstructedStructureIds.size > 0) {
        networkState.obstructedStructureIds.clear();
      }
      return;
    }

    const nextObstructed = new Set();
    const camPos = activeCamera.position;

    charactersWorldPositions.forEach(({ pos }) => {
      const dir = new THREE.Vector3().subVectors(pos, camPos);
      const dist = dir.length();
      dir.normalize();

      raycaster.set(camPos, dir);
      
      const intersects = raycaster.intersectObjects(walls);
      intersects.forEach((hit) => {
        // Obstructing if the wall is closer than the token
        if (hit.distance < dist) {
          const structId = hit.object.userData.structureId;
          nextObstructed.add(structId);
        }
      });
    });

    // Detect if set contents changed to avoid triggering state updates unnecessarily
    let changed = false;
    if (nextObstructed.size !== networkState.obstructedStructureIds.size) {
      changed = true;
    } else {
      for (let id of nextObstructed) {
        if (!networkState.obstructedStructureIds.has(id)) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      networkState.obstructedStructureIds = nextObstructed;
    }
  });
  // Reactive footprint preview for SketchUp style drawing
  const drawingPreview = $derived.by(() => {
    if (!networkState.drawingStartHex || !hoveredHex) return null;
    const C1 = networkState.drawingStartHex.c;
    const R1 = networkState.drawingStartHex.r;
    const C2 = hoveredHex.c;
    const R2 = hoveredHex.r;

    const structType = networkState.drawingStructureType || 'house';

    if (structType === 'wall-line') {
      const p1 = hexToWorld(C1, R1);
      const p2 = hexToWorld(C2, R2);
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const length = Math.sqrt(dx * dx + dz * dz) || 0.1;
      const angle = Math.atan2(dx, dz);
      const centerX = (p1.x + p2.x) / 2;
      const centerZ = (p1.z + p2.z) / 2;

      return {
        type: 'wall-line',
        x: centerX,
        z: centerZ,
        length,
        angle,
        y: (networkState.currentViewLevel - 1) * 2.0
      };
    } else if (structType === 'floor-plane') {
      const currentPts = networkState.floorDrawingPoints || [];
      if (currentPts.length === 0) return null;
      const mapped = currentPts.map(pt => hexToWorld(pt.c, pt.r));
      const hoveredW = hexToWorld(hoveredHex.c, hoveredHex.r);
      mapped.push(hoveredW);
      return {
        type: 'floor-polygon-preview',
        points: mapped,
        y: (networkState.currentViewLevel - 1) * 2.0
      };
    } else {
      const minC = Math.min(C1, C2);
      const maxC = Math.max(C1, C2);
      const minR = Math.min(R1, R2);
      const maxR = Math.max(R1, R2);

      const width = maxC - minC + 1;
      const depth = maxR - minR + 1;
      const c_center = minC + (width - 1) / 2;
      const r_center = minR + (depth - 1) / 2;

      const worldPos = hexToWorld(c_center, r_center);
      return {
        type: structType,
        x: worldPos.x,
        z: worldPos.z,
        width,
        depth: depth * Math.sqrt(3) / 2,
        y: (networkState.currentViewLevel - 1) * 2.0
      };
    }
  });

  function handleGroundPointerMove(e) {
    const { x, z } = e.point;
    const snapped = worldToHex(x, z);
    let c = Math.max(0, Math.min(gridSize - 1, snapped.c));
    let r = Math.max(0, Math.min(gridSize - 1, snapped.r));

    // Snap to wall if in draw mode, move mode, or dragging a piece
    if (networkState.drawingMode || networkState.activeTool === 'move' || networkState.draggedPieceId) {
      const snappedToWall = networkState.snapToWall(c, r);
      c = snappedToWall.c;
      r = snappedToWall.r;

      // Diagonal snapping logic for drawing stairs
      if (networkState.drawingMode && networkState.drawingStructureType === 'stair' && networkState.drawingStartHex) {
        const C1 = networkState.drawingStartHex.c;
        const R1 = networkState.drawingStartHex.r;
        const dc = c - C1;
        const dr = r - R1;
        const step = Math.max(1, Math.round((Math.abs(dc) + Math.abs(dr)) / 2));
        c = C1 + Math.sign(dc) * step;
        r = R1 + Math.sign(dr) * step;
      }
    }

    hoveredHex = { c, r };

    if (networkState.draggedPieceId) {
      const piece = networkState.gameState.pieces[networkState.draggedPieceId];
      if (piece) {
        if (piece.structureType === 'wall-line' && piece.x2 !== undefined) {
          const dx = piece.x2 - piece.x;
          const dz = piece.z2 - piece.z;
          piece.x = c;
          piece.z = r;
          piece.x2 = c + dx;
          piece.z2 = r + dz;
        } else {
          piece.x = c;
          piece.z = r;
        }
      }
    }
  }

  function handleGroundPointerLeave() {
    hoveredHex = null;
  }

  // Handle clicking on the ground grid
  function handleGroundClick(e) {
    e.stopPropagation();

    const { x, z } = e.point;
    const snapped = worldToHex(x, z);
    let targetX = Math.max(0, Math.min(gridSize - 1, snapped.c));
    let targetZ = Math.max(0, Math.min(gridSize - 1, snapped.r));

    if (networkState.drawingMode || networkState.activeTool === 'move') {
      const snappedToWall = networkState.snapToWall(targetX, targetZ);
      targetX = snappedToWall.c;
      targetZ = snappedToWall.r;

      // Diagonal snapping logic for drawing stairs
      if (networkState.drawingMode && networkState.drawingStructureType === 'stair' && networkState.drawingStartHex) {
        const C1 = networkState.drawingStartHex.c;
        const R1 = networkState.drawingStartHex.r;
        const dc = targetX - C1;
        const dr = targetZ - R1;
        const step = Math.max(1, Math.round((Math.abs(dc) + Math.abs(dr)) / 2));
        targetX = C1 + Math.sign(dc) * step;
        targetZ = R1 + Math.sign(dr) * step;
      }
    }

    if (networkState.role === 'host' && networkState.drawingMode) {
      const structType = networkState.drawingStructureType || 'house';

      if (structType === 'floor-plane') {
        const currentPts = networkState.floorDrawingPoints || [];
        if (currentPts.length === 0) {
          networkState.floorDrawingPoints = [{ c: targetX, r: targetZ }];
          networkState.drawingStartHex = { c: targetX, r: targetZ };
          networkState.addLog(`Floor drawing started at hex (${targetX}, ${targetZ}). Click next vertex.`);
        } else {
          const first = currentPts[0];
          if (targetX === first.c && targetZ === first.r) {
            if (currentPts.length >= 4) {
              networkState.addDrawnFloorPolygon(currentPts);
              networkState.floorDrawingPoints = [];
              networkState.drawingStartHex = null;
              networkState.drawingMode = false;
              networkState.activeTool = 'hand';
            } else {
              networkState.addLog("O chão precisa de pelo menos 4 vértices para fechar a forma.");
            }
          } else {
            networkState.floorDrawingPoints = [...currentPts, { c: targetX, r: targetZ }];
            networkState.addLog(`Vértice adicionado (${networkState.floorDrawingPoints.length} pontos). Clique no ponto inicial para fechar ou pressione Enter.`);
          }
        }
        return;
      }

      if (networkState.drawingStartHex === null) {
        networkState.drawingStartHex = { c: targetX, r: targetZ };
        networkState.addLog(`Drawing started at hex (${targetX}, ${targetZ}). Click endpoint.`);
      } else {
        const C1 = networkState.drawingStartHex.c;
        const R1 = networkState.drawingStartHex.r;
        const C2 = targetX;
        const R2 = targetZ;

        if (structType === 'wall-line') {
          networkState.addDrawnWallLine(C1, R1, C2, R2);
          // Sims-style: chain drawing — endpoint becomes new start point
          networkState.drawingStartHex = { c: C2, r: R2 };
          networkState.addLog(`Wall placed! Chaining from (${C2}, ${R2}). Click next point or press Escape to finish.`);
        } else {
          const minC = Math.min(C1, C2);
          const maxC = Math.max(C1, C2);
          const minR = Math.min(R1, R2);
          const maxR = Math.max(R1, R2);

          const w = maxC - minC + 1;
          const d = maxR - minR + 1;
          const c_center = minC + (w - 1) / 2;
          const r_center = minR + (d - 1) / 2;

          networkState.addDrawnStructure(c_center, r_center, w, d, structType);

          // Non-wall types: reset back to hand tool
          networkState.drawingStartHex = null;
          networkState.drawingMode = false;
          networkState.activeTool = 'hand';
        }
      }
      return;
    }

    if (networkState.activeTool === 'particles') {
      if (networkState.role === 'host') {
        networkState.triggerParticles(targetX, targetZ);
      } else {
        networkState.addLog('BLOCKED: Only the Host (Master) can trigger particle bursts.');
      }
      return;
    }

    if (networkState.selectedPieceId === null) return;

    // Direct movement on red highlighted hexes (adjacent movement range)
    const isRedHex = movementHexes.some(hex => hex.c === targetX && hex.r === targetZ);
    if (isRedHex) {
      networkState.requestMove(networkState.selectedPieceId, targetX, selectedPiece ? (selectedPiece.y || 0) : 0, targetZ);
      networkState.selectedPieceId = null;
      return;
    }

    if (networkState.activeTool !== 'move') {
      networkState.addLog(`BLOCKED: Select the Move Tool (🎯 Move) in the toolbar to relocate pieces.`);
      return;
    }

    // Request the move from network state (Host executes / Client requests)
    networkState.requestMove(networkState.selectedPieceId, targetX, 0, targetZ);

    // Deselect after moving
    networkState.selectedPieceId = null;
  }

  function handleRedHexClick(e, c, r) {
    e.stopPropagation();
    if (networkState.selectedPieceId !== null) {
      const p = networkState.gameState.pieces[networkState.selectedPieceId];
      if (p) {
        networkState.requestMove(networkState.selectedPieceId, c, p.y || 0, r);
        networkState.selectedPieceId = null;
      }
    }
  }

  onMount(() => {
    const handleGlobalPointerUp = () => {
      if (networkState.draggedPieceId) {
        const pieceId = networkState.draggedPieceId;
        const piece = networkState.gameState.pieces[pieceId];
        const startHex = networkState.draggedPieceStartHex;
        if (piece && startHex) {
          const targetC = piece.x;
          const targetR = piece.z;
          // Temporarily restore start position so validation functions evaluate correctly
          piece.x = startHex.c;
          piece.z = startHex.r;
          networkState.requestMove(pieceId, targetC, piece.y, targetR);
        } else if (piece) {
          networkState.requestMove(pieceId, piece.x, piece.y, piece.z);
        }
        networkState.draggedPieceId = null;
        networkState.draggedPieceStartHex = null;
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  });
</script>

<!-- 2.5D Camera Setup: looking down diagonally (Orthographic Isometric) -->
<T.OrthographicCamera
  makeDefault
  bind:ref={cameraRef}
  zoom={40}
  near={0.1}
  far={2000}
>
  <OrbitControls
    bind:ref={controlsRef}
    enableDamping
    dampingFactor={0.08}
    enablePan={!networkState.draggedPieceId}
    enableRotate={!networkState.draggedPieceId}
    enableZoom={!networkState.draggedPieceId}
    zoomToCursor
    screenSpacePanning={false}
    mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
    touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    maxPolarAngle={Math.PI / 2.1} // Prevent orbiting below ground level
    minPolarAngle={Math.PI / 7}
    minDistance={3}
    maxDistance={maxZoomDistance}
  />
</T.OrthographicCamera>

<!-- Ambient & Directional Lights -->
<T.AmbientLight color={ambientColor} intensity={ambientIntensity} />
<T.DirectionalLight 
  position={[gridSize / 2, 16, gridSize / 2]} 
  intensity={2.0} 
  color={directionalColor} 
  castShadow
/>

<!-- Gaussian Splat Immersive Background -->
<SplatBackground 
  position={[gridSize / 2, -0.5, gridSize / 2]} 
  scale={[5, 5, 5]} 
/>

<!-- Hex Grid Line segments -->
{#key hexGridPoints.length + '-' + networkState.currentViewLevel}
  <T.LineSegments position={[0, (networkState.currentViewLevel - 1) * 2.0, 0]} frustumCulled={false}>
    <T.BufferGeometry bind:ref={bufferGeometry} />
    <T.LineBasicMaterial color={gridColor} transparent opacity={0.65} />
  </T.LineSegments>
{/key}

<!-- Visual Basic Ground Plane (Plano Básico) -->
{#key gridSize + '-' + basicPlaneSizeSetting}
  <T.Mesh position={[gridSize / 2, -0.02, zMax / 2]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
    <T.PlaneGeometry args={[basicPlaneWidth, basicPlaneDepth]} />
    <T.MeshBasicMaterial color={basicPlaneColor} transparent opacity={0.75} side={THREE.DoubleSide} />
  </T.Mesh>
{/key}

<!-- GM Spiritual Burst Particle Effects -->
{#each (networkState.gameState.activeParticles || []) as burst (burst.id)}
  {@const age = frameTime - burst.timestamp}
  {#if age < 1500}
    {@const scaleVal = 0.1 + (age / 1500) * 3.5}
    {@const opacityVal = 1.0 - (age / 1500)}
    {@const burstWorld = hexToWorld(burst.x, burst.z)}
    <!-- Expanding Spiritual Ring 1 -->
    <T.Mesh position={[burstWorld.x, 0.06, burstWorld.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[scaleVal, scaleVal, 1]}>
      <T.RingGeometry args={[0.8, 1.0, 32]} />
      <T.MeshBasicMaterial color={gridColor} transparent opacity={opacityVal * 0.8} side={THREE.DoubleSide} />
    </T.Mesh>
    <!-- Expanding Inner Ring 2 (Red Core) -->
    <T.Mesh position={[burstWorld.x, 0.07, burstWorld.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[scaleVal * 0.6, scaleVal * 0.6, 1]}>
      <T.RingGeometry args={[0.0, 0.5, 32]} />
      <T.MeshBasicMaterial color="#ef4444" transparent opacity={opacityVal * 0.6} side={THREE.DoubleSide} />
    </T.Mesh>
  {/if}
{/each}

<!-- Hover Highlight -->
{#if hoveredHex}
  {@const hoverPos = hexToWorld(hoveredHex.c, hoveredHex.r)}
  <T.Mesh position={[hoverPos.x, 0.015, hoverPos.z]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
    <T.RingGeometry args={[0, 1 / Math.sqrt(3), 6]} />
    <T.MeshBasicMaterial color={gridColor} transparent opacity={0.25} side={THREE.DoubleSide} />
  </T.Mesh>
  <T.Mesh position={[hoverPos.x, 0.015, hoverPos.z]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
    <T.RingGeometry args={[1 / Math.sqrt(3) - 0.05, 1 / Math.sqrt(3), 6]} />
    <T.MeshBasicMaterial color={gridColor} transparent opacity={0.65} side={THREE.DoubleSide} />
  </T.Mesh>
{/if}

<!-- Movement Highlight adjacent red hexes -->
{#each movementHexes as hex}
  {@const pos = hexToWorld(hex.c, hex.r)}
  {@const pieceY = selectedPiece.y || 0}
  <T.Mesh 
    position={[pos.x, pieceY + 0.012, pos.z]} 
    rotation={[-Math.PI / 2, 0, Math.PI / 6]}
    onpointerdown={(e) => handleRedHexClick(e, hex.c, hex.r)}
    onclick={(e) => handleRedHexClick(e, hex.c, hex.r)}
  >
    <T.RingGeometry args={[0, 1 / Math.sqrt(3), 6]} />
    <T.MeshBasicMaterial color="#ef4444" transparent opacity={0.25} side={THREE.DoubleSide} />
  </T.Mesh>
  <T.Mesh 
    position={[pos.x, pieceY + 0.012, pos.z]} 
    rotation={[-Math.PI / 2, 0, Math.PI / 6]}
    onpointerdown={(e) => handleRedHexClick(e, hex.c, hex.r)}
    onclick={(e) => handleRedHexClick(e, hex.c, hex.r)}
  >
    <T.RingGeometry args={[1 / Math.sqrt(3) - 0.05, 1 / Math.sqrt(3), 6]} />
    <T.MeshBasicMaterial color="#ef4444" transparent opacity={0.75} side={THREE.DoubleSide} />
  </T.Mesh>
{/each}

<!-- SketchUp Footprint Drawing Preview -->
{#if drawingPreview}
  {#if drawingPreview.type === 'wall-line'}
    <!-- Wall segment preview -->
    <T.Mesh position={[drawingPreview.x, drawingPreview.y + 1.0, drawingPreview.z]} rotation={[0, drawingPreview.angle, 0]}>
      <T.BoxGeometry args={[0.15, 2.0, drawingPreview.length]} />
      <T.MeshBasicMaterial color="#a855f7" transparent opacity={0.55} side={THREE.DoubleSide} />
    </T.Mesh>
    <T.Mesh position={[drawingPreview.x, drawingPreview.y + 1.0, drawingPreview.z]} rotation={[0, drawingPreview.angle, 0]}>
      <T.BoxGeometry args={[0.18, 2.02, drawingPreview.length + 0.05]} />
      <T.MeshBasicMaterial color="#a855f7" wireframe side={THREE.DoubleSide} />
    </T.Mesh>
  {:else if drawingPreview.type === 'floor-polygon-preview'}
    {@const tempShape = (() => {
      const shp = new THREE.Shape();
      shp.moveTo(drawingPreview.points[0].x, -drawingPreview.points[0].z);
      for (let i = 1; i < drawingPreview.points.length; i++) {
        shp.lineTo(drawingPreview.points[i].x, -drawingPreview.points[i].z);
      }
      shp.closePath();
      return shp;
    })()}
    <T.Mesh position={[0, drawingPreview.y + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.ShapeGeometry args={[tempShape]} />
      <T.MeshBasicMaterial color="#a855f7" transparent opacity={0.4} side={THREE.DoubleSide} />
    </T.Mesh>
    <T.Mesh position={[0, drawingPreview.y + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.ShapeGeometry args={[tempShape]} />
      <T.MeshBasicMaterial color="#a855f7" wireframe side={THREE.DoubleSide} />
    </T.Mesh>
  {:else}
    <T.Mesh position={[drawingPreview.x, drawingPreview.y || 0.02, drawingPreview.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.PlaneGeometry args={[drawingPreview.width, drawingPreview.depth]} />
      <T.MeshBasicMaterial color="#a855f7" transparent opacity={0.4} side={THREE.DoubleSide} />
    </T.Mesh>
    <T.Mesh position={[drawingPreview.x, (drawingPreview.y || 0.02) + 0.002, drawingPreview.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.PlaneGeometry args={[drawingPreview.width + 0.1, drawingPreview.depth + 0.1]} />
      <T.MeshBasicMaterial color="#a855f7" wireframe side={THREE.DoubleSide} />
    </T.Mesh>
  {/if}
{/if}

<!-- Draw mode: start anchor indicator (cyan ring at the chain start point) -->
{#if networkState.drawingMode}
  {#if networkState.activeTool === 'draw-floor'}
    {#if networkState.floorDrawingPoints && networkState.floorDrawingPoints.length > 0}
      {#each networkState.floorDrawingPoints as pt, idx}
        {@const ptWorld = hexToWorld(pt.c, pt.r)}
        {@const anchorY = (networkState.currentViewLevel - 1) * 2.0}
        <T.Mesh position={[ptWorld.x, anchorY + 0.025, ptWorld.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <T.RingGeometry args={[0.12, 0.25, 24]} />
          <T.MeshBasicMaterial color={idx === 0 ? "#10b981" : "#22d3ee"} transparent opacity={0.9} side={THREE.DoubleSide} />
        </T.Mesh>
        <T.Mesh position={[ptWorld.x, anchorY + 0.15, ptWorld.z]}>
          <T.SphereGeometry args={[0.12, 16, 16]} />
          <T.MeshBasicMaterial color={idx === 0 ? "#10b981" : "#22d3ee"} transparent opacity={0.8} />
        </T.Mesh>
      {/each}
    {/if}
  {:else if networkState.drawingStartHex !== null}
    {@const startWorld = hexToWorld(networkState.drawingStartHex.c, networkState.drawingStartHex.r)}
    {@const anchorY = (networkState.currentViewLevel - 1) * 2.0}
    <!-- Anchor floor ring -->
    <T.Mesh position={[startWorld.x, anchorY + 0.025, startWorld.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.RingGeometry args={[0.15, 0.32, 24]} />
      <T.MeshBasicMaterial color="#22d3ee" transparent opacity={0.9} side={THREE.DoubleSide} />
    </T.Mesh>
    <!-- Anchor vertical pole -->
    <T.Mesh position={[startWorld.x, anchorY + 1.0, startWorld.z]}>
      <T.CylinderGeometry args={[0.04, 0.04, 2.0, 8]} />
      <T.MeshBasicMaterial color="#22d3ee" transparent opacity={0.7} />
    </T.Mesh>
  {/if}
{/if}



<!-- Custom Background Map Image -->
{#if backgroundTexture}
  {#key gridSize}
    <T.Mesh position={[gridSize / 2, -0.012, zMax / 2]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
      <T.PlaneGeometry args={[gridSize, zMax]} />
      <T.MeshBasicMaterial 
        map={backgroundTexture} 
        side={THREE.DoubleSide} 
        transparent={true}
        opacity={networkState.gameState.backgroundImageOpacity ?? 1.0}
      />
    </T.Mesh>
  {/key}
{/if}

<!-- Chunked 2D background map ground -->
{#if !networkState.gameState.backgroundImage}
  {#each chunkIndices as chunk (chunk.row + '-' + chunk.col)}
    <MapChunk 
      row={chunk.row} 
      col={chunk.col} 
      chunkSize={chunkSize} 
    />
  {/each}
{/if}

<!-- Invisible raycast plane for capturing clicks on the ground -->
{#key gridSize + '-' + basicPlaneSizeSetting + '-' + networkState.currentViewLevel}
  <T.Mesh 
    rotation={[-Math.PI / 2, 0, 0]} 
    position={[gridSize / 2, (networkState.currentViewLevel - 1) * 2.0 + 0.05, zMax / 2]}
    onpointerdown={handleGroundClick}
    onclick={handleGroundClick}
    onpointermove={handleGroundPointerMove}
    onpointerleave={handleGroundPointerLeave}
    visible={true}
    frustumCulled={false}
  >
    <T.PlaneGeometry args={[basicPlaneWidth, basicPlaneDepth]} />
    <T.MeshBasicMaterial transparent={true} opacity={0} side={THREE.DoubleSide} />
  </T.Mesh>
{/key}

<!-- Authoritative pieces sync -->
{#each Object.values(networkState.gameState.pieces) as piece (piece.id)}
  {@const worldPos = hexToWorld(piece.x, piece.z)}
  {#if piece.structureType === 'house'}
    <Building
      id={piece.id}
      name={piece.name}
      x={worldPos.x}
      y={piece.y}
      z={worldPos.z}
      hexX={piece.x}
      hexZ={piece.z}
      color={piece.color}
      shape={piece.shape}
      width={piece.width}
      depth={piece.depth}
      floors={piece.floors}
      activeFloor={piece.activeFloor}
      height={piece.height}
      isObstructing={networkState.obstructedStructureIds.has(piece.id)}
      textureUrl={piece.textureUrl}
    />
  {:else if piece.structureType === 'wall-line'}
    <WallLine
      id={piece.id}
      name={piece.name}
      x={piece.x}
      z={piece.z}
      x2={piece.x2}
      z2={piece.z2}
      y={piece.y}
      color={piece.color}
      height={piece.height}
      thickness={piece.thickness}
      openings={piece.openings}
      isObstructing={networkState.obstructedStructureIds.has(piece.id)}
      textureUrl={piece.textureUrl}
    />
  {:else if piece.structureType === 'door'}
    <Door
      id={piece.id}
      name={piece.name}
      x={piece.x}
      z={piece.z}
      x2={piece.x2}
      z2={piece.z2}
      y={piece.y}
      color={piece.color}
      height={piece.height}
      thickness={piece.thickness}
    />
  {:else if piece.structureType === 'window'}
    <Window
      id={piece.id}
      name={piece.name}
      x={piece.x}
      z={piece.z}
      x2={piece.x2}
      z2={piece.z2}
      y={piece.y}
      color={piece.color}
      height={piece.height}
      thickness={piece.thickness}
    />
  {:else if piece.structureType === 'stair'}
    <Stair
      id={piece.id}
      name={piece.name}
      x={piece.x}
      z={piece.z}
      x2={piece.x2}
      z2={piece.z2}
      y={piece.y}
      y2={piece.y2}
      color={piece.color}
    />
  {:else if piece.structureType === 'floor-plane'}
    <FloorPlane
      id={piece.id}
      name={piece.name}
      x={worldPos.x - piece.width / 2}
      y={piece.y}
      z={worldPos.z - (piece.depth * Math.sqrt(3) / 2) / 2}
      width={piece.width}
      depth={piece.depth * Math.sqrt(3) / 2}
      color={piece.color}
      textureUrl={piece.textureUrl}
      points={piece.points}
    />
  {:else}
    <Piece
      id={piece.id}
      name={piece.name}
      pieceClass={piece.class}
      x={worldPos.x}
      y={networkState.getPieceRenderHeight(piece)}
      z={worldPos.z}
      hexX={piece.x}
      hexZ={piece.z}
      color={piece.color}
      textureUrl={piece.textureUrl}
      scale={piece.scale ?? 1.0}
    />
  {/if}
{/each}
