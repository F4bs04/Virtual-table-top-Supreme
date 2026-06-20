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
  import Shape3D from './Shape3D.svelte';
  import * as THREE from 'three';

  const currentRenderEnvId = $derived.by(() => {
    const selectedPiece = networkState.getPiece(networkState.selectedPieceId);
    if (selectedPiece && selectedPiece.class === 'personagem' && selectedPiece.environmentId) {
      return selectedPiece.environmentId;
    }
    return networkState.gameState.currentEnvironmentId || 'env-1';
  });

  const envConfig = $derived(networkState.gameState.environments?.[currentRenderEnvId] || {
    theme: 'soul-society',
    backgroundImage: '/mapa.jpeg',
    backgroundImageOpacity: 1.0
  });

  const renderedPieces = $derived.by(() => {
    const chars = Object.values(networkState.gameState.pieces || {}).filter(
      p => p.class === 'personagem' && (p.environmentId || 'env-1') === currentRenderEnvId
    );
    const objs = Object.values(envConfig.pieces || {});
    return [...chars, ...objs];
  });

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

  // Neutral lighting for accurate piece colors
  const ambientColor = $derived.by(() => {
    const theme = envConfig.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#e2e8f0'; // Slightly cool white
    if (theme === 'karakura-town') return '#fef3c7'; // Slightly warm white
    return '#ffffff'; // Neutral white
  });

  const ambientIntensity = $derived.by(() => {
    return 1.0;
  });

  const directionalColor = $derived.by(() => {
    const theme = envConfig.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#f8fafc';
    if (theme === 'karakura-town') return '#fffbeb';
    return '#ffffff';
  });

  const gridColor = $derived.by(() => {
    const theme = envConfig.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#c084fc';
    if (theme === 'karakura-town') return '#fdba74';
    return '#06b6d4';
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
    const theme = envConfig.theme || 'soul-society';
    if (theme === 'hueco-mundo') return '#1e1b4b';
    if (theme === 'karakura-town') return '#0f172a';
    return '#111827';
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
  let dragTargetHex = $state(null); // final hex preview while right-dragging a character

  const selectedPiece = $derived(networkState.selectedPieceId ? networkState.getPiece(networkState.selectedPieceId) : null);

  $effect(() => {
    if (typeof window !== 'undefined') {
      console.log('[DEBUG] role:', networkState.role, 'selectedPieceId:', networkState.selectedPieceId, 'selectedPiece:', selectedPiece?.name, 'pieces count:', Object.keys(networkState.gameState.pieces).length);
    }
  });

  // Hexes reachable for normal move plus dash preview when the character can pay the EP cost.
  const movementHexes = $derived.by(() => {
    if (networkState.drawingMode || networkState.activeTool === 'particles') return [];
    if (!selectedPiece || selectedPiece.class !== 'personagem') {
      if (typeof window !== 'undefined') {
        console.log('[DEBUG] movementHexes blocked: selectedPiece=', !!selectedPiece, 'class=', selectedPiece?.class);
      }
      return [];
    }

    const dashRange = selectedPiece.dashRange ?? 3;
    const dashEpCost = selectedPiece.dashEpCost ?? 20;
    const canDash = (selectedPiece.ep ?? 0) >= dashEpCost;
    const maxDist = networkState.dashMode ? dashRange : Math.max(1, canDash ? dashRange : 1);
    const cs = selectedPiece.x;
    const rs = selectedPiece.z;
    const hexes = [];

    for (let dr = -maxDist; dr <= maxDist; dr++) {
      for (let dc = -(maxDist * 2); dc <= maxDist * 2; dc++) {
        const tc = cs + dc;
        const tr = rs + dr;
        if (tc >= 0 && tc < gridSize && tr >= 0 && tr < gridSize) {
          const d = getHexDistance(cs, rs, tc, tr);
          if (d >= 1 && d <= maxDist && !networkState.isCellBlocked(tc, tr, selectedPiece)) {
            const isDash = networkState.dashMode || d > 1;
            if (!isDash || canDash) {
              hexes.push({ c: tc, r: tr, isDash });
            }
          }
        }
      }
    }
    if (typeof window !== 'undefined') {
      console.log('[DEBUG] movementHexes count:', hexes.length, 'dashMode:', networkState.dashMode, 'canDash:', (selectedPiece?.ep ?? 0) >= (selectedPiece?.dashEpCost ?? 20));
    }
    return hexes;
  });

  // Background map texture loader
  let backgroundTexture = $state(null);
  $effect(() => {
    const bgUrl = envConfig.backgroundImage;
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

  function getCanvasPointer(e) {
    const canvas = document.querySelector('canvas');
    if (!canvas || !camera.current) return null;

    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  function getPointerHex(e) {
    const pointer = getCanvasPointer(e);
    if (!pointer) return null;

    raycaster.setFromCamera(pointer, camera.current);
    const floorY = (networkState.currentViewLevel - 1) * 2.0 + 0.05;
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
    const hitPoint = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return null;

    const snapped = worldToHex(hitPoint.x, hitPoint.z);
    return {
      c: Math.max(0, Math.min(gridSize - 1, snapped.c)),
      r: Math.max(0, Math.min(gridSize - 1, snapped.r))
    };
  }

  function isMeshVisibleInScene(obj) {
    let node = obj;
    while (node) {
      if (node.visible === false) return false;
      node = node.parent;
    }
    return true;
  }

  function isPieceRaycastable(pieceId) {
    const piece = networkState.getPiece(pieceId);
    if (!piece || piece.visibleOnMap === false) return false;

    const pieceFloor = Math.round((piece.y || 0) / 2.0) + 1;
    return pieceFloor <= networkState.currentViewLevel;
  }

  function collectPieceRaycastCandidates() {
    const candidates = [];
    scene.traverse((obj) => {
      if (!obj.isMesh || !isMeshVisibleInScene(obj)) return;

      let node = obj;
      while (node) {
        if (node.userData && node.userData.pieceId) {
          if (isPieceRaycastable(node.userData.pieceId)) {
            candidates.push({ mesh: obj, pieceId: node.userData.pieceId, pieceClass: node.userData.pieceClass });
          }
          break;
        }
        node = node.parent;
      }
    });
    return candidates;
  }

  function getPieceHit(e) {
    const pointer = getCanvasPointer(e);
    if (!pointer) return null;

    raycaster.setFromCamera(pointer, camera.current);

    const candidates = collectPieceRaycastCandidates();

    const intersects = raycaster.intersectObjects(candidates.map(c => c.mesh), false);
    if (intersects.length === 0) return null;

    const hitMesh = intersects[0].object;
    return candidates.find(c => c.mesh === hitMesh) || null;
  }


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
      const piece = networkState.getPiece(networkState.draggedPieceId);
      if (piece) {
        dragTargetHex = { c, r };
        if (networkState.role === 'host' && piece.class === 'personagem') {
          // Characters wait for the authoritative move commit on pointer release.
        } else if (piece.structureType === 'wall-line' && piece.x2 !== undefined) {
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
    if (e.button !== undefined && e.button !== 0) return; // Only respond to left clicks on ground
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
              networkState.activeTool = 'select';
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

          // Non-wall types: reset back to select tool
          networkState.drawingStartHex = null;
          networkState.drawingMode = false;
          networkState.activeTool = 'select';
        }
      }
      return;
    }

    if (networkState.activeTool === 'particles') {
      if (networkState.role === 'host') {
        networkState.triggerParticles(targetX, targetZ, networkState.activeParticleType || 'burst');
      } else {
        networkState.addLog('BLOCKED: Only the Host (Master) can trigger particle bursts.');
      }
      return;
    }

    if (networkState.selectedPieceId !== null) {
      if (networkState.activeTool === 'move' || networkState.role === 'client') {
        const moved = tryMoveSelectedToHex(targetX, targetZ);
        if (moved) return;
      }

      if (networkState.activeTool === 'hand' || networkState.activeTool === 'select') {
        if (networkState.suppressNextGroundDeselect) {
          networkState.suppressNextGroundDeselect = false;
          return;
        }

        if (networkState.role === 'client' && selectedPiece?.class === 'personagem') {
          return;
        }

        networkState.selectedPieceId = null;
        networkState.selectedEnvironmentId = null;
        networkState.dashMode = false;
      }
    }
  }

  function handleRedHexClick(e, c, r) {
    e?.stopPropagation();
    if (networkState.selectedPieceId !== null) {
      const p = networkState.getPiece(networkState.selectedPieceId);
      if (p) {
        networkState.requestMove(networkState.selectedPieceId, c, p.y || 0, r);
      }
    }
  }

  function handleDashHexClick(e, c, r) {
    e?.stopPropagation();
    if (networkState.selectedPieceId !== null && networkState.dashMode) {
      networkState.requestDash(networkState.selectedPieceId, c, r);
      networkState.dashMode = false;
      networkState.selectedPieceId = null;
      networkState.selectedEnvironmentId = null;
    }
  }

  function handleHexClick(e, c, r, isDash) {
    if (isDash) {
      handleDashHexClick(e, c, r);
    } else {
      handleRedHexClick(e, c, r);
    }
  }

  function tryMoveSelectedToHex(targetX, targetZ) {
    const pieceId = networkState.selectedPieceId;
    if (pieceId === null) return false;

    const selectedPieceObj = networkState.getPiece(pieceId);
    if (!selectedPieceObj) return false;

    const isDashHex = movementHexes.some(hex => hex.c === targetX && hex.r === targetZ && hex.isDash);
    if (networkState.dashMode || isDashHex) {
      if (!isDashHex) return false;
      networkState.requestDash(pieceId, targetX, targetZ);
      networkState.dashMode = false;
      return true;
    }

    const isMoveHex = movementHexes.some(hex => hex.c === targetX && hex.r === targetZ && !hex.isDash);
    if (!isMoveHex && !(networkState.role === 'host' && networkState.activeTool === 'move')) return false;

    networkState.requestMove(pieceId, targetX, selectedPieceObj.y || 0, targetZ);
    return true;
  }

  function isUiPointerEvent(e) {
    return !!e.target?.closest?.('.character-sheet, .control-section, .workspace-header, .gm-toolbar, .board-overlay, .floating-roll-banner');
  }

  onMount(() => {
    let leftClickStartTime = 0;
    let leftClickStartPos = { x: 0, y: 0 };
    let rightClickStartTime = 0;
    let rightClickStartPos = { x: 0, y: 0 };

    const handleGlobalPointerDown = (e) => {
      if (isUiPointerEvent(e)) return;

      if (e.button === 0) {
        leftClickStartTime = Date.now();
        leftClickStartPos = { x: e.clientX, y: e.clientY };

        // GM left-click on a piece initiates drag
        if (networkState.role === 'host' && networkState.activeTool === 'move') {
          const canvas = document.querySelector('canvas');
          if (canvas && camera.current) {
            const mouse = new THREE.Vector2(
              ((e.clientX - canvas.getBoundingClientRect().left) / canvas.getBoundingClientRect().width) * 2 - 1,
              -((e.clientY - canvas.getBoundingClientRect().top) / canvas.getBoundingClientRect().height) * 2 + 1
            );
            raycaster.setFromCamera(mouse, camera.current);
            const candidates = collectPieceRaycastCandidates();
            const gizmoMeshes = [];
            scene.traverse((obj) => {
              if (obj.isMesh) {
                let node = obj;
                while (node) {
                  if (node.userData) {
                    if (node.userData.isGizmo) {
                      gizmoMeshes.push(obj);
                      break;
                    }
                  }
                  node = node.parent;
                }
              }
            });
            const targetMeshes = [
              ...gizmoMeshes,
              ...candidates.map(c => c.mesh)
            ];
            const intersects = raycaster.intersectObjects(targetMeshes, false);
            if (intersects.length > 0) {
              const hitMesh = intersects[0].object;
              if (gizmoMeshes.includes(hitMesh)) {
                console.log('[DEBUG] handleGlobalPointerDown: Intersected gizmo first, ignoring drag initiation.');
                return;
              }
              const found = candidates.find(c => c.mesh === hitMesh);
              if (found) {
                const piece = networkState.getPiece(found.pieceId);
                if (piece) {
                  networkState.draggedPieceId = found.pieceId;
                  networkState.draggedPieceStartHex = { c: piece.x, r: piece.z };
                  dragTargetHex = { c: piece.x, r: piece.z };
                  networkState.addLog(`Arrastando ${piece.name}...`);
                }
              }
            }
          }
        }
      }
      if (e.button === 2) {
        rightClickStartTime = Date.now();
        rightClickStartPos = { x: e.clientX, y: e.clientY };

        if (networkState.drawingMode) {
          networkState.drawingStartHex = null;
          networkState.floorDrawingPoints = [];
          networkState.drawingMode = false;
          networkState.activeTool = 'select';
          networkState.addLog('Construção cancelada (botão direito). Modo select ativo.');
        }
      }
    };

    const handleGlobalPointerUp = (e) => {
      if (isUiPointerEvent(e)) return;

      // 1. Left Click: Selection
      if (e.button === 0) {
        const elapsed = Date.now() - leftClickStartTime;
        const dist = Math.hypot(e.clientX - leftClickStartPos.x, e.clientY - leftClickStartPos.y);

        // GM left-click drag: commit on release (long click or drag)
        if (networkState.draggedPieceId) {
          const pieceId = networkState.draggedPieceId;
          if (elapsed >= 350 || dist >= 15) {
            const piece = networkState.getPiece(pieceId);
            const startHex = networkState.draggedPieceStartHex;
            if (piece && startHex) {
              const targetC = dragTargetHex?.c ?? piece.x;
              const targetR = dragTargetHex?.r ?? piece.z;
              if (piece.class === 'personagem') {
                piece.x = startHex.c;
                piece.z = startHex.r;
              }
              networkState.requestMove(pieceId, targetC, piece.y, targetR);
            } else if (piece) {
              networkState.requestMove(pieceId, piece.x, piece.y, piece.z);
            }
            networkState.draggedPieceId = null;
            networkState.draggedPieceStartHex = null;
            dragTargetHex = null;
            networkState.selectedPieceId = null;
            networkState.selectedEnvironmentId = null;
            return;
          } else {
            // Short click: cancel drag, keep selection
            const piece = networkState.getPiece(pieceId);
            const startHex = networkState.draggedPieceStartHex;
            if (piece && startHex) {
              if (piece.structureType === 'wall-line' && piece.x2 !== undefined) {
                const dx = piece.x2 - piece.x;
                const dz = piece.z2 - piece.z;
                piece.x = startHex.c;
                piece.z = startHex.r;
                piece.x2 = startHex.c + dx;
                piece.z2 = startHex.r + dz;
              } else {
                piece.x = startHex.c;
                piece.z = startHex.r;
              }
              // Set the selected piece
              networkState.selectedPieceId = pieceId;
              networkState.addLog(`Selecionado: ${piece.name}`);
            }
            networkState.draggedPieceId = null;
            networkState.draggedPieceStartHex = null;
            dragTargetHex = null;
            return;
          }
        }

        if (elapsed < 350 && dist < 15) {
          if (networkState.activeTool === 'particles') {
            const targetHex = getPointerHex(e);
            if (targetHex) {
              if (networkState.role === 'host') {
                networkState.triggerParticles(targetHex.c, targetHex.r, networkState.activeParticleType || 'burst');
              } else {
                networkState.addLog('BLOCKED: Only the Host (Master) can trigger particle bursts.');
              }
            }
            return;
          }

          const canvas = document.querySelector('canvas');
          if (canvas && camera.current) {
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2(
              ((e.clientX - rect.left) / rect.width) * 2 - 1,
              -((e.clientY - rect.top) / rect.height) * 2 + 1
            );

            raycaster.setFromCamera(mouse, camera.current);

            const candidates = collectPieceRaycastCandidates();
            const hexCandidates = [];
            const gizmoMeshes = [];
            scene.traverse((obj) => {
              if (obj.isMesh) {
                let node = obj;
                while (node) {
                  if (node.userData) {
                    if (node.userData.isGizmo) {
                      gizmoMeshes.push(obj);
                      break;
                    }
                    if (node.userData.isMovementHex) {
                      hexCandidates.push({ mesh: obj, hexC: node.userData.hexC, hexR: node.userData.hexR, hexIsDash: node.userData.hexIsDash });
                      break;
                    }
                  }
                  node = node.parent;
                }
              }
            });

            // Perform single raycast to preserve proper depth ordering
            const targetMeshes = [
              ...gizmoMeshes,
              ...candidates.map(c => c.mesh),
              ...hexCandidates.map(c => c.mesh)
            ];

            const intersects = raycaster.intersectObjects(targetMeshes, false);
            if (intersects.length > 0) {
              const hitMesh = intersects[0].object;

              // 1. Gizmo clicked -> ignore
              if (gizmoMeshes.includes(hitMesh)) {
                console.log('[DEBUG] handleGlobalPointerUp: Intersected gizmo first, ignoring click.');
                return;
              }

              // 2. Piece clicked -> select
              const foundPiece = candidates.find(c => c.mesh === hitMesh);
              if (foundPiece) {
                const piece = networkState.getPiece(foundPiece.pieceId);
                if (piece) {
                  if (networkState.role === 'client' && piece.class !== 'personagem') {
                    return;
                  }
                  networkState.suppressNextGroundDeselect = false;
                  if (networkState.role === 'client') {
                    networkState.activeTool = 'hand';
                  }
                  networkState.dashMode = false;
                  networkState.selectedPieceId = foundPiece.pieceId;
                  networkState.selectedEnvironmentId = piece.class === 'personagem' ? null : currentRenderEnvId;
                  if (piece.class === 'personagem') {
                    networkState.addLog(`Selecionado: ${piece.name}. Clique no hex vermelho para mover.`);
                  } else {
                    networkState.addLog(`Selecionado objeto: ${piece.name}.`);
                  }
                }
                return;
              }

              // 3. Movement hex clicked -> move
              const foundHex = hexCandidates.find(c => c.mesh === hitMesh);
              if (foundHex) {
                console.log('[DEBUG] handleGlobalPointerUp movement hex click:', foundHex.hexC, foundHex.hexR, foundHex.hexIsDash);
                handleHexClick(null, foundHex.hexC, foundHex.hexR, foundHex.hexIsDash);
                return;
              }
            }

            // Clicked empty ground -> deselect
            if (networkState.activeTool === 'hand' || networkState.activeTool === 'select') {
              if (networkState.suppressNextGroundDeselect) {
                networkState.suppressNextGroundDeselect = false;
                return;
              }

              if (networkState.role === 'client' && selectedPiece?.class === 'personagem') {
                return;
              }

              networkState.selectedPieceId = null;
              networkState.selectedEnvironmentId = null;
              networkState.dashMode = false;
            }
          }
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Cancel dash mode
        if (networkState.dashMode) {
          networkState.dashMode = false;
          networkState.addLog('Dash cancelado (ESC).');
          return;
        }
        // Cancel GM move lock
        if (networkState.moveLockPieceId) {
          // Restore piece to start hex
          const piece = networkState.getPiece(networkState.moveLockPieceId);
          const start = networkState.draggedPieceStartHex;
          if (piece && start) { piece.x = start.c; piece.z = start.r; }
          networkState.moveLockPieceId = null;
          networkState.draggedPieceStartHex = null;
          dragTargetHex = null;
          networkState.addLog('Move cancelado (ESC).');
        }
      }
    };

    window.addEventListener('pointerdown', handleGlobalPointerDown);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('keydown', handleKeyDown);
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
  castShadow={!networkState.gameState.gameModeActive}
/>
<!-- Gaussian Splat Immersive Background -->
{#if networkState.showSplat}
  <SplatBackground 
    position={[gridSize / 2, -0.5, gridSize / 2]} 
    scale={[5, 5, 5]} 
  />
{/if}

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
{#if !networkState.gameState.gameModeActive}
{#each (networkState.gameState.activeParticles || []) as burst (burst.id)}
  {@const effectType = burst.effectType || 'burst'}
  {@const age = frameTime - burst.timestamp}
  {@const effectY = (networkState.currentViewLevel - 1) * 2.0}
  
  {#if effectType === 'burst'}
    {#if age < 1500}
      {@const scaleVal = 0.1 + (age / 1500) * 3.5}
      {@const opacityVal = 1.0 - (age / 1500)}
      {@const burstWorld = hexToWorld(burst.x, burst.z)}
      <!-- Expanding Spiritual Ring 1 -->
      <T.Mesh position={[burstWorld.x, effectY + 0.09, burstWorld.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[scaleVal, scaleVal, 1]}>
        <T.RingGeometry args={[0.8, 1.0, 32]} />
        <T.MeshBasicMaterial color={gridColor} transparent opacity={opacityVal * 0.8} side={THREE.DoubleSide} />
      </T.Mesh>
      <!-- Expanding Inner Ring 2 (Red Core) -->
      <T.Mesh position={[burstWorld.x, effectY + 0.1, burstWorld.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[scaleVal * 0.6, scaleVal * 0.6, 1]}>
        <T.RingGeometry args={[0.0, 0.5, 32]} />
        <T.MeshBasicMaterial color="#ef4444" transparent opacity={opacityVal * 0.6} side={THREE.DoubleSide} />
      </T.Mesh>
    {/if}

  {:else if effectType === 'falling'}
    {#if age < 1500}
      {@const burstWorld = hexToWorld(burst.x, burst.z)}
      {@const progress = age / 1500}
      <!-- Render 8 falling particles -->
      {#each [
        { dx: -0.3, dz: -0.2, speed: 1.0, size: 0.07, delay: 0.0 },
        { dx: 0.4, dz: 0.3, speed: 1.2, size: 0.05, delay: 0.15 },
        { dx: -0.1, dz: 0.4, speed: 0.9, size: 0.08, delay: 0.05 },
        { dx: 0.2, dz: -0.4, speed: 1.1, size: 0.06, delay: 0.2 },
        { dx: -0.4, dz: 0.1, speed: 1.3, size: 0.04, delay: 0.1 },
        { dx: 0.3, dz: -0.1, speed: 0.8, size: 0.09, delay: 0.25 },
        { dx: 0.0, dz: 0.0, speed: 1.0, size: 0.10, delay: 0.0 },
        { dx: -0.2, dz: -0.3, speed: 1.15, size: 0.05, delay: 0.3 }
      ] as offset}
        {@const pProgress = ((progress * offset.speed) + offset.delay) % 1.0}
        {@const pY = 4.0 - pProgress * 4.0}
        {@const opacityVal = (1.0 - pProgress) * (1.0 - progress)}
          <T.Mesh position={[burstWorld.x + offset.dx, effectY + pY, burstWorld.z + offset.dz]}>
          <T.SphereGeometry args={[offset.size, 8, 8]} />
          <T.MeshBasicMaterial color={gridColor} transparent opacity={opacityVal} />
        </T.Mesh>
      {/each}
    {/if}

  {:else if effectType === 'bubbles'}
    {#if age < 1500}
      {@const burstWorld = hexToWorld(burst.x, burst.z)}
      {@const progress = age / 1500}
      <!-- Render 8 rising bubble orbs -->
      {#each [
        { dx: -0.2, dz: -0.1, speed: 1.1, size: 0.08, delay: 0.0 },
        { dx: 0.3, dz: 0.2, speed: 0.9, size: 0.10, delay: 0.1 },
        { dx: -0.3, dz: 0.3, speed: 1.2, size: 0.06, delay: 0.05 },
        { dx: 0.1, dz: -0.3, speed: 1.0, size: 0.07, delay: 0.15 },
        { dx: -0.1, dz: 0.1, speed: 0.8, size: 0.12, delay: 0.2 },
        { dx: 0.2, dz: -0.1, speed: 1.3, size: 0.05, delay: 0.25 },
        { dx: 0.0, dz: 0.0, speed: 1.0, size: 0.14, delay: 0.0 },
        { dx: -0.3, dz: -0.2, speed: 0.75, size: 0.11, delay: 0.3 }
      ] as offset}
        {@const pProgress = ((progress * offset.speed) + offset.delay) % 1.0}
        {@const pY = 0.08 + pProgress * 3.0}
        {@const opacityVal = (1.0 - pProgress) * (1.0 - progress)}
          <T.Mesh position={[burstWorld.x + offset.dx, effectY + pY, burstWorld.z + offset.dz]}>
          <T.SphereGeometry args={[offset.size, 8, 8]} />
          <T.MeshBasicMaterial color="#38bdf8" transparent opacity={opacityVal} />
        </T.Mesh>
      {/each}
    {/if}

  {:else if effectType === 'lightning'}
    {#if age < 1000}
      {@const burstWorld = hexToWorld(burst.x, burst.z)}
      {@const progress = age / 1000}
      {@const flicker = Math.sin(age * 0.08) > 0}
      {@const opacityVal = (flicker ? 0.95 : 0.25) * (1.0 - progress)}
      <!-- Vertical Glowing Cylinder for the main strike -->
      <T.Mesh position={[burstWorld.x, effectY + 3.0, burstWorld.z]}>
        <T.CylinderGeometry args={[0.08, 0.15, 6.0, 8]} />
        <T.MeshBasicMaterial color="#fbbf24" transparent opacity={opacityVal} />
      </T.Mesh>
      <!-- Ground flash ring -->
      <T.Mesh position={[burstWorld.x, effectY + 0.09, burstWorld.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <T.RingGeometry args={[0.0, 1.2, 32]} />
        <T.MeshBasicMaterial color="#fbbf24" transparent opacity={opacityVal * 0.5} side={THREE.DoubleSide} />
      </T.Mesh>
    {/if}

  {:else if effectType === 'light'}
    {#if age < 1500}
      {@const burstWorld = hexToWorld(burst.x, burst.z)}
      {@const progress = age / 1500}
      {@const scaleVal = 0.1 + progress * 2.8}
      {@const opacityVal = Math.sin(progress * Math.PI) * 0.95}
      <!-- Growing glowing sphere -->
      <T.Mesh position={[burstWorld.x, effectY + 0.8, burstWorld.z]} scale={[scaleVal, scaleVal, scaleVal]}>
        <T.SphereGeometry args={[0.8, 16, 16]} />
        <T.MeshBasicMaterial color="#ffffff" transparent opacity={opacityVal} />
      </T.Mesh>
      <!-- Outer flare ring -->
      <T.Mesh position={[burstWorld.x, effectY + 0.09, burstWorld.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[scaleVal * 1.5, scaleVal * 1.5, 1]}>
        <T.RingGeometry args={[0, 1.0, 32]} />
        <T.MeshBasicMaterial color={gridColor} transparent opacity={opacityVal * 0.6} side={THREE.DoubleSide} />
      </T.Mesh>
    {/if}
  {/if}
{/each}
{/if}

<!-- Hover Highlight: subtle thin glow ring only, no fill -->
{#if hoveredHex}
  {@const hoverPos = hexToWorld(hoveredHex.c, hoveredHex.r)}
  {@const hoverY = (networkState.currentViewLevel - 1) * 2.0 + 0.085}
  <!-- Outer thin ring -->
  <T.Mesh position={[hoverPos.x, hoverY, hoverPos.z]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
    <T.RingGeometry args={[1 / Math.sqrt(3) - 0.06, 1 / Math.sqrt(3) - 0.01, 6]} />
    <T.MeshBasicMaterial color={gridColor} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
  </T.Mesh>
  <!-- Inner subtle fill, very low opacity -->
  <T.Mesh position={[hoverPos.x, hoverY + 0.001, hoverPos.z]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
    <T.RingGeometry args={[0, 1 / Math.sqrt(3) - 0.06, 6]} />
    <T.MeshBasicMaterial color={gridColor} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
  </T.Mesh>
{/if}

<!-- Movement Highlight — red for normal move, cyan for dash -->
{#each movementHexes as hex}
  {@const pos = hexToWorld(hex.c, hex.r)}
  {@const pieceY = Math.max(selectedPiece ? (selectedPiece.y || 0) : 0, (networkState.currentViewLevel - 1) * 2.0)}
  {@const rangeY = pieceY + 0.01}
  {@const hexColor = hex.isDash ? '#06b6d4' : '#ef4444'}
  <!-- Subtle inner fill -->
  <T.Mesh 
    position={[pos.x, rangeY, pos.z]} 
    rotation={[-Math.PI / 2, 0, Math.PI / 6]}
    frustumCulled={false}
    renderOrder={999}
    userData={{ hexC: hex.c, hexR: hex.r, hexIsDash: hex.isDash, isMovementHex: true }}
    onpointerdown={(e) => {
      if (e.button === 0) {
        e.stopPropagation();
        handleHexClick(e, hex.c, hex.r, hex.isDash);
      }
    }}
  >
    <T.RingGeometry args={[0, 1 / Math.sqrt(3) - 0.02, 6]} />
    <T.MeshBasicMaterial color={hexColor} transparent opacity={hex.isDash ? 0.15 : 0.1} side={THREE.DoubleSide} depthWrite={false} />
  </T.Mesh>
  <!-- Thin glowing outer border -->
  <T.Mesh 
    position={[pos.x, rangeY + 0.002, pos.z]} 
    rotation={[-Math.PI / 2, 0, Math.PI / 6]}
    frustumCulled={false}
    renderOrder={999}
    userData={{ hexC: hex.c, hexR: hex.r, hexIsDash: hex.isDash, isMovementHex: true }}
    onpointerdown={(e) => {
      if (e.button === 0) {
        e.stopPropagation();
        handleHexClick(e, hex.c, hex.r, hex.isDash);
      }
    }}
  >
    <T.RingGeometry args={[1 / Math.sqrt(3) - 0.02, 1 / Math.sqrt(3), 6]} />
    <T.MeshBasicMaterial color={hexColor} transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
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
        opacity={envConfig.backgroundImageOpacity ?? 1.0}
      />
    </T.Mesh>
  {/key}
{/if}

<!-- Chunked 2D background map ground -->
{#if !envConfig.backgroundImage}
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
    <T.MeshBasicMaterial transparent={true} opacity={0} side={THREE.DoubleSide} depthWrite={false} />
  </T.Mesh>
{/key}

<!-- Authoritative pieces sync -->
{#each renderedPieces as piece (piece.id)}
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
      textureRepeat={piece.textureRepeat}
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
      textureRepeat={piece.textureRepeat}
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
      textureRepeat={piece.textureRepeat}
      points={piece.points}
    />
  {:else if piece.structureType === '3d-shape'}
    <Shape3D
      id={piece.id}
      x={worldPos.x}
      y={networkState.getPieceRenderHeight(piece)}
      z={worldPos.z}
      color={piece.color}
      width={piece.width}
      depth={piece.depth}
      height={piece.height}
      shapeType={piece.shapeType || 'box'}
      modelUrl={piece.modelUrl || ''}
      textureUrl={piece.textureUrl || ''}
      textureRepeat={piece.textureRepeat}
      rotation={piece.rotation || 0}
      isObstructing={networkState.obstructedStructureIds.has(piece.id)}
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
