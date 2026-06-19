<script>
  import { T, useThrelte } from '@threlte/core';
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { networkState } from '../networkState.svelte.js';
  import { hexToWorld } from '../hexGeometry.js';

  let {
    id,
    x,
    y,
    z,
    color,
    width = 1,
    depth = 1,
    height = 1,
    shapeType = 'box',
    modelUrl = '',
    textureUrl = '',
    textureRepeat = 1,
    rotation = 0,
    isObstructing = false
  } = $props();

  let modelScene = $state(null);
  let loadError = $state(false);
  let groupRef = $state(null);
  let textureMap = $state(null);
  let matRef = $state(null);

  // Gizmo States
  let ringHovered = $state(false);
  let elevHovered = $state(false);
  let xHovered = $state(false);
  let zHovered = $state(false);

  let isRotating = $state(false);
  let startAngle = 0;
  let startRotation = 0;

  let isElevating = $state(false);
  let startElevPointerY = 0;
  let startElevY = 0;
  let startMouseY = 0;

  let isTranslatingX = $state(false);
  let startXPointerX = 0;
  let startXPointerY = 0;
  let startXVal = 0;

  let isTranslatingZ = $state(false);
  let startZPointerX = 0;
  let startZPointerY = 0;
  let startZVal = 0;

  const { camera } = useThrelte();

  // Window handlers for rotation (Blender style center pivot)
  function handleRotateStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isRotating = true;
    startRotation = rotation;
    
    const center3D = new THREE.Vector3(x, y, z);
    center3D.project(camera.current);
    const centerX = (center3D.x * 0.5 + 0.5) * window.innerWidth;
    const centerY = (-(center3D.y * 0.5) + 0.5) * window.innerHeight;
    
    startAngle = Math.atan2(e.nativeEvent.clientY - centerY, e.nativeEvent.clientX - centerX);
    
    networkState.draggedPieceId = id; // disable orbit controls
    networkState.addLog('Rotacionando objeto...');

    window.addEventListener('pointermove', handleWindowRotateMove);
    window.addEventListener('pointerup', handleWindowRotateEnd);
  }

  function handleWindowRotateMove(e) {
    if (!networkState.draggedPieceId) return;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    const delta = currentAngle - startAngle;
    const newRot = startRotation - delta;
    const piece = networkState.getPiece(id);
    if (piece) piece.rotation = newRot;
  }

  function handleWindowRotateEnd(e) {
    e.preventDefault();
    networkState.draggedPieceId = null;
    window.removeEventListener('pointermove', handleWindowRotateMove);
    window.removeEventListener('pointerup', handleWindowRotateEnd);
    networkState.broadcastGameState();
    networkState.addLog(`Objeto girado`);
  }

  // Window handlers for elevation (Y Axis)
  function handleElevStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isElevating = true;
    startElevY = y;
    startMouseY = e.nativeEvent.clientY;
    networkState.draggedPieceId = id;
    networkState.addLog('Ajustando altura do objeto...');

    window.addEventListener('pointermove', handleWindowElevMove);
    window.addEventListener('pointerup', handleWindowElevEnd);
  }

  function handleWindowElevMove(e) {
    if (!networkState.draggedPieceId) return;
    const dy = e.clientY - startMouseY;
    const sens = 0.8 / (camera.current?.zoom || 40);
    const deltaY = -dy * sens;
    const newY = Math.max(0, startElevY + deltaY);
    const piece = networkState.getPiece(id);
    if (piece) piece.y = newY;
  }

  function handleWindowElevEnd(e) {
    e.preventDefault();
    networkState.draggedPieceId = null;
    window.removeEventListener('pointermove', handleWindowElevMove);
    window.removeEventListener('pointerup', handleWindowElevEnd);
    networkState.broadcastGameState();
    networkState.addLog(`Elevação do objeto ajustada`);
  }

  // Helper to project screen delta to world coordinates for translation
  function screenDeltaToWorld(dx, dy) {
    if (!camera.current) return new THREE.Vector3();
    const v = new THREE.Vector3(dx, -dy, 0);
    v.unproject(camera.current);
    const origin = new THREE.Vector3(0, 0, 0);
    origin.unproject(camera.current);
    return v.sub(origin).multiplyScalar(20); // Arbitrary scaling for feel
  }

  // Window handlers for Translation X (Blender style camera space projection)
  function handleTransXStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isTranslatingX = true;
    startXVal = x;
    startXPointerX = e.nativeEvent.clientX;
    startXPointerY = e.nativeEvent.clientY;
    networkState.draggedPieceId = id;
    networkState.addLog('Movendo objeto no eixo X...');

    window.addEventListener('pointermove', handleWindowTransXMove);
    window.addEventListener('pointerup', handleWindowTransXEnd);
  }

  function handleWindowTransXMove(e) {
    if (!isTranslatingX) return;
    const dx = e.clientX - startXPointerX;
    const dy = e.clientY - startXPointerY;
    
    const cameraDir = new THREE.Vector3();
    camera.current.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    cameraDir.normalize();

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDir, new THREE.Vector3(0, 1, 0)).normalize();

    const sens = 0.8 / (camera.current?.zoom || 40);
    const worldDelta = new THREE.Vector3();
    worldDelta.addScaledVector(cameraRight, dx * sens);
    worldDelta.addScaledVector(cameraDir, -dy * sens);

    const deltaX = worldDelta.x;
    const newX = Math.max(0, Math.min(networkState.gameState.gridSize || 24, startXVal + deltaX));
    networkState.gameState.pieces[id].x = newX;
  }

  function handleTransXEnd(e) {
    if (!isTranslatingX) return;
    isTranslatingX = false;
    networkState.draggedPieceId = null;
    window.removeEventListener('pointermove', handleWindowTransXMove);
    window.removeEventListener('pointerup', handleWindowTransXEnd);
    networkState.gameState.pieces[id].x = Math.round(networkState.gameState.pieces[id].x);
    networkState.broadcastGameState();
    networkState.addLog(`Objeto movido para X: ${networkState.gameState.pieces[id].x}`);
  }

  // Window handlers for Translation Z (Blender style camera space projection)
  function handleTransZStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isTranslatingZ = true;
    startZVal = z;
    startZPointerX = e.nativeEvent.clientX;
    startZPointerY = e.nativeEvent.clientY;
    networkState.draggedPieceId = id;
    networkState.addLog('Movendo objeto no eixo Z...');

    window.addEventListener('pointermove', handleWindowTransZMove);
    window.addEventListener('pointerup', handleWindowTransZEnd);
  }

  function handleWindowTransZMove(e) {
    if (!isTranslatingZ) return;
    const dx = e.clientX - startZPointerX;
    const dy = e.clientY - startZPointerY;

    const cameraDir = new THREE.Vector3();
    camera.current.getWorldDirection(cameraDir);
    cameraDir.y = 0;
    cameraDir.normalize();

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDir, new THREE.Vector3(0, 1, 0)).normalize();

    const sens = 0.8 / (camera.current?.zoom || 40);
    const worldDelta = new THREE.Vector3();
    worldDelta.addScaledVector(cameraRight, dx * sens);
    worldDelta.addScaledVector(cameraDir, -dy * sens);

    const deltaZ = worldDelta.z;
    const newZ = Math.max(0, Math.min(networkState.gameState.gridSize || 24, startZVal + deltaZ));
    networkState.gameState.pieces[id].z = newZ;
  }

  function handleTransZEnd(e) {
    if (!isTranslatingZ) return;
    isTranslatingZ = false;
    networkState.draggedPieceId = null;
    window.removeEventListener('pointermove', handleWindowTransZMove);
    window.removeEventListener('pointerup', handleWindowTransZEnd);
    networkState.gameState.pieces[id].z = Math.round(networkState.gameState.pieces[id].z);
    networkState.broadcastGameState();
    networkState.addLog(`Objeto movido para Z: ${networkState.gameState.pieces[id].z}`);
  }

  onDestroy(() => {
    window.removeEventListener('pointermove', handleWindowRotateMove);
    window.removeEventListener('pointerup', handleWindowRotateEnd);
    window.removeEventListener('pointermove', handleWindowElevMove);
    window.removeEventListener('pointerup', handleWindowElevEnd);
    window.removeEventListener('pointermove', handleWindowTransXMove);
    window.removeEventListener('pointerup', handleWindowTransXEnd);
    window.removeEventListener('pointermove', handleWindowTransZMove);
    window.removeEventListener('pointerup', handleWindowTransZEnd);
  });

  const floorHeight = 2.0;
  const tokenFloor = $derived(Math.round(y / floorHeight) + 1);
  const opacityMultiplier = $derived.by(() => {
    const diff = networkState.currentViewLevel - tokenFloor;
    if (diff === 0) return 1.0;
    if (diff > 0) return 0.35;
    return 0.0;
  });
  const isVisible = $derived(opacityMultiplier > 0.05);

  // Check if any player character is inside this 3D shape's bounding box
  const isCharacterInside = $derived.by(() => {
    const wVal = width || 1;
    const dVal = depth || 1;
    const hVal = height || 1;
    
    // Get all player character pieces
    const characters = Object.values(networkState.gameState.pieces).filter(
      p => p.class === 'personagem'
    );
    
    return characters.some(p => {
      const wp = hexToWorld(p.x, p.z);
      const py = networkState.getPieceRenderHeight(p);
      
      const dx = wp.x - x;
      const dz = wp.z - z;
      const dy = py - y;
      
      // Rotate back by the object's rotation (around Y axis)
      const cos = Math.cos(-rotation);
      const sin = Math.sin(-rotation);
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      
      const margin = 0.25; // generous margin for playability
      const insideX = Math.abs(localX) <= (wVal / 2 + margin);
      const insideZ = Math.abs(localZ) <= (dVal / 2 + margin);
      const insideY = dy >= -margin && dy <= (hVal + margin);
      
      return insideX && insideZ && insideY;
    });
  });

  const isCutAway = $derived(isCharacterInside || isObstructing);
  const finalOpacity = $derived((isCutAway ? 0.25 : 1.0) * opacityMultiplier);

  // Adjust opacity and register structureId for imported GLTF model meshes
  $effect(() => {
    if (modelScene) {
      modelScene.traverse((child) => {
        if (child.isMesh) {
          if (!child.userData) child.userData = {};
          child.userData.structureId = id; // register for raycast walls detection
          
          if (child.material) {
            child.material.transparent = finalOpacity < 0.95;
            child.material.opacity = (child.userData.originalOpacity !== undefined ? child.userData.originalOpacity : 1.0) * finalOpacity;
            if (child.userData.originalOpacity === undefined) {
              child.userData.originalOpacity = child.material.opacity ?? 1.0;
            }
            child.material.side = isCutAway ? THREE.BackSide : (child.userData.originalSide !== undefined ? child.userData.originalSide : THREE.DoubleSide);
            if (child.userData.originalSide === undefined) {
              child.userData.originalSide = child.material.side;
            }
          }
        }
      });
    }
  });

  const w = $derived(width || 1);
  const d = $derived(depth || 1);
  const h = $derived(height || 1);

  // Castle wall: generate battlements positions
  const battlementsData = $derived.by(() => {
    const battlementCount = Math.max(2, Math.floor(w / 0.4));
    const spacing = w / battlementCount;
    const battlementWidth = spacing * 0.55;
    const battlementHeight = h * 0.25;
    const positions = [];
    for (let i = 0; i < battlementCount; i++) {
      const cx = -w / 2 + spacing * i + spacing / 2;
      positions.push({ cx, bw: battlementWidth, bh: battlementHeight });
    }
    return positions;
  });

  // Normal roof (triangular prism) geometry
  const roofGeometry = $derived.by(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(0, h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: false
    });
    geom.center();
    return geom;
  });

  // Imported model loading
  onMount(() => {
    if (shapeType === 'imported' && modelUrl) {
      loadModel(modelUrl);
    }
  });

  async function loadModel(url) {
    try {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => { modelScene = gltf.scene; },
        undefined,
        (err) => {
          console.error('Error loading 3D model:', err);
          loadError = true;
        }
      );
    } catch (e) {
      console.error('Failed to load GLTFLoader:', e);
      loadError = true;
    }
  }

  $effect(() => {
    if (groupRef && modelScene) {
      groupRef.add(modelScene);
      return () => groupRef.remove(modelScene);
    }
  });

  $effect(() => {
    if (groupRef) {
      groupRef.position.set(x, y, z);
    }
  });

  // Texture loading
  $effect(() => {
    if (textureUrl && shapeType !== 'imported') {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          if (matRef) { matRef.map = tex; matRef.needsUpdate = true; } textureMap = tex;
        },
        undefined,
        () => { textureMap = null; }
      );
    } else {
      textureMap = null;
    }
  });

  // Texture repeat update
  $effect(() => {
    if (textureMap) {
      const rep = Number(textureRepeat) || 1;
      textureMap.repeat.set(rep, rep);
      textureMap.needsUpdate = true;
    }
  });

  function handlePointerDown(e) {
    if (e.button === 0) {
      e.stopPropagation();
      networkState.selectedPieceId = id;
      networkState.suppressNextGroundDeselect = true;
      networkState.addLog('Selected 3D shape');
    }
  }

  function handleClick(e) {
    e.stopPropagation();
  }

  function yCenter(type) {
    if (type === 'sphere') return h / 2;
    return h / 2;
  }
</script>

<T.Group position={[x, y, z]} rotation={[0, rotation, 0]} onclick={handleClick} userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }} visible={isVisible}>
  {#if shapeType === 'imported'}
    <T.Group bind:ref={groupRef} userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}>
      {#if !modelScene && !loadError}
        <T.Mesh position={[0, 0.15, 0]}>
          <T.BoxGeometry args={[0.3, 0.3, 0.3]} />
          <T.MeshBasicMaterial color={color} transparent opacity={0.3 * finalOpacity} />
        </T.Mesh>
      {:else if loadError}
        <T.Mesh position={[0, 0.25, 0]}>
          <T.BoxGeometry args={[0.5, 0.5, 0.5]} />
          <T.MeshBasicMaterial color="#ef4444" wireframe transparent opacity={finalOpacity} />
        </T.Mesh>
      {/if}
    </T.Group>

  {:else if shapeType === 'castle-wall'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
    >
      <T.BoxGeometry args={[w, h * 0.75, d]} />
      <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.8} metalness={0.1} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
    </T.Mesh>
    {#each battlementsData as b (b.cx)}
      <T.Mesh position={[b.cx, h * 0.875, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.BoxGeometry args={[b.bw, b.bh, d * 0.8]} />
        <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.8} metalness={0.1} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
      </T.Mesh>
    {/each}
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.BoxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.15 * finalOpacity} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'box'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
    >
      <T.BoxGeometry args={[w, h, d]} />
      <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.6} metalness={0.2} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.BoxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2 * finalOpacity} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'cylinder'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
    >
      <T.CylinderGeometry args={[w / 2, w / 2, h, 24]} />
      <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.6} metalness={0.2} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.CylinderGeometry args={[w / 2 + 0.02, w / 2 + 0.02, h + 0.02, 24]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2 * finalOpacity} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'sphere'}
    <T.Mesh position={[0, w / 2, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
    >
      <T.SphereGeometry args={[w / 2, 24, 24]} />
      <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.6} metalness={0.2} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, w / 2, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.SphereGeometry args={[w / 2 + 0.02, 24, 24]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2 * finalOpacity} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'pyramid'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
    >
      <T.ConeGeometry args={[w / 2, h, 4]} />
      <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.6} metalness={0.2} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.ConeGeometry args={[w / 2 + 0.02, h + 0.02, 4]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2 * finalOpacity} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'stairs'}
    <T.Group position={[0, 0, 0]}>
      {#each Array(5) as _, i}
        {@const stepHeight = h / 5}
        {@const stepDepth = d / 5}
        <T.Mesh 
          position={[0, stepHeight * (i + 0.5), -d/2 + stepDepth * (i + 0.5)]}
          onpointerdown={handlePointerDown}
          userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
        >
          <T.BoxGeometry args={[w, stepHeight, stepDepth * (5 - i)]} />
          <T.MeshStandardMaterial
            bind:ref={matRef}
            color={textureMap ? '#ffffff' : color}
            map={textureMap}
            transparent={finalOpacity < 0.95}
            opacity={finalOpacity}
            side={shapeType === 'box' || shapeType === 'sphere' ? THREE.FrontSide : THREE.DoubleSide}
          />
        </T.Mesh>
      {/each}
      {#if networkState.activeTool === 'move'}
        <T.Mesh position={[0, h * 0.5, 0]}
          onpointerdown={handlePointerDown}
          userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
        >
          <T.BoxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
          <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2 * finalOpacity} />
        </T.Mesh>
      {/if}
    </T.Group>

  {:else if shapeType === 'round-roof'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
    >
      <T.ConeGeometry args={[w / 2, h, 24]} />
      <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.6} metalness={0.2} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.ConeGeometry args={[w / 2 + 0.02, h + 0.02, 24]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2 * finalOpacity} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'roof'}
    <T.Mesh position={[0, h * 0.5, 0]}
      geometry={roofGeometry}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
    >
      <T.MeshStandardMaterial bind:ref={matRef} color={textureMap ? '#ffffff' : color} map={textureMap} roughness={0.6} metalness={0.2} transparent={finalOpacity < 0.95} opacity={finalOpacity} side={isCutAway ? THREE.BackSide : THREE.DoubleSide} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        geometry={roofGeometry}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto', structureId: id }}
      >
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2 * finalOpacity} />
      </T.Mesh>
    {/if}
  {/if}

  <!-- Move/Rotate Gizmo for Host (GM) -->
  {#if networkState.activeTool === 'move' && networkState.selectedPieceId === id && networkState.role === 'host'}
    <T.Group rotation={[0, -rotation, 0]} onclick={(e) => e.stopPropagation()} onpointerup={(e) => e.stopPropagation()}>
      
      <!-- Rotation Torus Ring -->
      <T.Mesh 
        position={[0, 0.05, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        onpointerdown={handleRotateStart}
        onclick={(e) => e.stopPropagation()}
        onpointerover={() => ringHovered = true}
        onpointerout={() => ringHovered = false}
        userData={{ isGizmo: true }}
      >
        <T.TorusGeometry args={[Math.max(w, d) * 0.75, 0.06, 8, 32]} />
        <T.MeshBasicMaterial color={ringHovered ? '#06b6d4' : '#f59e0b'} transparent opacity={0.8} />
      </T.Mesh>

      <!-- Elevation (Vertical Move) Gizmo Arrow (Y Axis) -->
      <T.Group 
        position={[0, h + 0.2, 0]}
        onpointerdown={handleElevStart}
        onclick={(e) => e.stopPropagation()}
        onpointerover={() => elevHovered = true}
        onpointerout={() => elevHovered = false}
      >
        <!-- Shaft -->
        <T.Mesh userData={{ isGizmo: true }}>
          <T.CylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <T.MeshBasicMaterial color={elevHovered ? '#22c55e' : '#10b981'} />
        </T.Mesh>
        <!-- Head -->
        <T.Mesh position={[0, 0.25, 0]} userData={{ isGizmo: true }}>
          <T.ConeGeometry args={[0.08, 0.2, 8]} />
          <T.MeshBasicMaterial color={elevHovered ? '#22c55e' : '#10b981'} />
        </T.Mesh>
      </T.Group>

      <!-- Red Translation Arrow (X Axis) -->
      <T.Group 
        position={[w * 0.5 + 0.3, 0.05, 0]}
        rotation={[0, 0, -Math.PI / 2]}
        onpointerdown={handleTransXStart}
        onclick={(e) => e.stopPropagation()}
        onpointerover={() => xHovered = true}
        onpointerout={() => xHovered = false}
      >
        <T.Mesh userData={{ isGizmo: true }}>
          <T.CylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <T.MeshBasicMaterial color={xHovered ? '#ef4444' : '#b91c1c'} />
        </T.Mesh>
        <T.Mesh position={[0, 0.25, 0]} userData={{ isGizmo: true }}>
          <T.ConeGeometry args={[0.08, 0.2, 8]} />
          <T.MeshBasicMaterial color={xHovered ? '#ef4444' : '#b91c1c'} />
        </T.Mesh>
      </T.Group>

      <!-- Blue Translation Arrow (Z Axis) -->
      <T.Group 
        position={[0, 0.05, d * 0.5 + 0.3]}
        rotation={[Math.PI / 2, 0, 0]}
        onpointerdown={handleTransZStart}
        onclick={(e) => e.stopPropagation()}
        onpointerover={() => zHovered = true}
        onpointerout={() => zHovered = false}
      >
        <T.Mesh userData={{ isGizmo: true }}>
          <T.CylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <T.MeshBasicMaterial color={zHovered ? '#3b82f6' : '#1d4ed8'} />
        </T.Mesh>
        <T.Mesh position={[0, 0.25, 0]} userData={{ isGizmo: true }}>
          <T.ConeGeometry args={[0.08, 0.2, 8]} />
          <T.MeshBasicMaterial color={zHovered ? '#3b82f6' : '#1d4ed8'} />
        </T.Mesh>
      </T.Group>

    </T.Group>
  {/if}
</T.Group>


