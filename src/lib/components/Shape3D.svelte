<script>
  import { T } from '@threlte/core';
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { networkState } from '../networkState.svelte.js';

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
    rotation = 0
  } = $props();

  let modelScene = $state(null);
  let loadError = $state(false);
  let groupRef = $state(null);
  let textureMap = $state(null);

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

  let isTranslatingX = $state(false);
  let startXPointerX = 0;
  let startXVal = 0;

  let isTranslatingZ = $state(false);
  let startZPointerY = 0;
  let startZVal = 0;

  function handleRotateStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isRotating = true;
    startRotation = rotation;
    const centerWorld = new THREE.Vector3(x, y, z);
    const hitPoint = e.point;
    if (hitPoint) {
      startAngle = Math.atan2(hitPoint.x - centerWorld.x, hitPoint.z - centerWorld.z);
    }
    networkState.draggedPieceId = id; // disable orbit controls
    networkState.addLog('Rotacionando objeto...');
  }

  function handleRotateMove(e) {
    if (!isRotating) return;
    e.stopPropagation();
    const centerWorld = new THREE.Vector3(x, y, z);
    const hitPoint = e.point;
    if (hitPoint) {
      const currentAngle = Math.atan2(hitPoint.x - centerWorld.x, hitPoint.z - centerWorld.z);
      const delta = currentAngle - startAngle;
      const newRot = startRotation + delta;
      networkState.gameState.pieces[id].rotation = newRot;
    }
  }

  function handleRotateEnd(e) {
    if (!isRotating) return;
    e.stopPropagation();
    isRotating = false;
    networkState.draggedPieceId = null;
    networkState.broadcastGameState();
    networkState.addLog('Rotação concluída.');
  }

  function handleElevStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isElevating = true;
    startElevY = y;
    startElevPointerY = e.nativeEvent.clientY;
    networkState.draggedPieceId = id; // disable orbit controls
    networkState.addLog('Ajustando altura do objeto...');
  }

  function handleElevMove(e) {
    if (!isElevating) return;
    e.stopPropagation();
    const deltaY = (startElevPointerY - e.nativeEvent.clientY) * 0.05;
    const newY = Math.max(0, startElevY + deltaY);
    networkState.gameState.pieces[id].y = newY;
  }

  function handleElevEnd(e) {
    if (!isElevating) return;
    e.stopPropagation();
    isElevating = false;
    networkState.draggedPieceId = null;
    networkState.broadcastGameState();
    networkState.addLog(`Altura do objeto ajustada para ${y.toFixed(2)}`);
  }

  function handleTransXStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isTranslatingX = true;
    const piece = networkState.gameState.pieces[id];
    startXVal = piece.x;
    startXPointerX = e.nativeEvent.clientX;
    networkState.draggedPieceId = id;
    networkState.addLog('Movendo objeto no eixo X...');
  }

  function handleTransXMove(e) {
    if (!isTranslatingX) return;
    e.stopPropagation();
    // Drag ratio: screen space drag delta translated into grid units
    const deltaX = (e.nativeEvent.clientX - startXPointerX) * 0.08;
    const newX = Math.max(0, Math.min(networkState.gameState.gridSize || 24, startXVal + deltaX));
    networkState.gameState.pieces[id].x = newX;
  }

  function handleTransXEnd(e) {
    if (!isTranslatingX) return;
    e.stopPropagation();
    isTranslatingX = false;
    networkState.draggedPieceId = null;
    // Snap to nearest integer on grid
    networkState.gameState.pieces[id].x = Math.round(networkState.gameState.pieces[id].x);
    networkState.broadcastGameState();
    networkState.addLog(`Objeto movido para X: ${networkState.gameState.pieces[id].x}`);
  }

  function handleTransZStart(e) {
    if (networkState.role !== 'host') return;
    e.stopPropagation();
    isTranslatingZ = true;
    const piece = networkState.gameState.pieces[id];
    startZVal = piece.z;
    startZPointerY = e.nativeEvent.clientY;
    networkState.draggedPieceId = id;
    networkState.addLog('Movendo objeto no eixo Z...');
  }

  function handleTransZMove(e) {
    if (!isTranslatingZ) return;
    e.stopPropagation();
    const deltaZ = (e.nativeEvent.clientY - startZPointerY) * 0.08;
    const newZ = Math.max(0, Math.min(networkState.gameState.gridSize || 24, startZVal + deltaZ));
    networkState.gameState.pieces[id].z = newZ;
  }

  function handleTransZEnd(e) {
    if (!isTranslatingZ) return;
    e.stopPropagation();
    isTranslatingZ = false;
    networkState.draggedPieceId = null;
    // Snap to nearest integer on grid
    networkState.gameState.pieces[id].z = Math.round(networkState.gameState.pieces[id].z);
    networkState.broadcastGameState();
    networkState.addLog(`Objeto movido para Z: ${networkState.gameState.pieces[id].z}`);
  }

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
          textureMap = tex;
        },
        undefined,
        () => { textureMap = null; }
      );
    } else {
      textureMap = null;
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

<T.Group position={[x, y, z]} rotation={[0, rotation, 0]} onclick={handleClick} userData={{ pieceId: id, pieceClass: 'objeto' }}>
  {#if shapeType === 'imported'}
    <T.Group bind:ref={groupRef} userData={{ pieceId: id, pieceClass: 'objeto' }}>
      {#if !modelScene && !loadError}
        <T.Mesh position={[0, 0.15, 0]}>
          <T.BoxGeometry args={[0.3, 0.3, 0.3]} />
          <T.MeshBasicMaterial color={color} transparent opacity={0.3} />
        </T.Mesh>
      {:else if loadError}
        <T.Mesh position={[0, 0.25, 0]}>
          <T.BoxGeometry args={[0.5, 0.5, 0.5]} />
          <T.MeshBasicMaterial color="#ef4444" wireframe />
        </T.Mesh>
      {/if}
    </T.Group>

  {:else if shapeType === 'castle-wall'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto' }}
    >
      <T.BoxGeometry args={[w, h * 0.75, d]} />
      <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.8} metalness={0.1} />
    </T.Mesh>
    {#each battlementsData as b (b.cx)}
      <T.Mesh position={[b.cx, h * 0.875, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.BoxGeometry args={[b.bw, b.bh, d * 0.8]} />
        <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.8} metalness={0.1} />
      </T.Mesh>
    {/each}
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.BoxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.15} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'box'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto' }}
    >
      <T.BoxGeometry args={[w, h, d]} />
      <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.6} metalness={0.2} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.BoxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'cylinder'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto' }}
    >
      <T.CylinderGeometry args={[w / 2, w / 2, h, 24]} />
      <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.6} metalness={0.2} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.CylinderGeometry args={[w / 2 + 0.02, w / 2 + 0.02, h + 0.02, 24]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'sphere'}
    <T.Mesh position={[0, w / 2, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto' }}
    >
      <T.SphereGeometry args={[w / 2, 24, 24]} />
      <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.6} metalness={0.2} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, w / 2, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.SphereGeometry args={[w / 2 + 0.02, 24, 24]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'pyramid'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto' }}
    >
      <T.ConeGeometry args={[w / 2, h, 4]} />
      <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.6} metalness={0.2} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.ConeGeometry args={[w / 2 + 0.02, h + 0.02, 4]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2} />
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
          userData={{ pieceId: id, pieceClass: 'objeto' }}
        >
          <T.BoxGeometry args={[w, stepHeight, stepDepth * (5 - i)]} />
          <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.6} metalness={0.2} />
        </T.Mesh>
      {/each}
      {#if networkState.activeTool === 'move'}
        <T.Mesh position={[0, h * 0.5, 0]}
          onpointerdown={handlePointerDown}
          userData={{ pieceId: id, pieceClass: 'objeto' }}
        >
          <T.BoxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
          <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2} />
        </T.Mesh>
      {/if}
    </T.Group>

  {:else if shapeType === 'round-roof'}
    <T.Mesh position={[0, h * 0.5, 0]}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto' }}
    >
      <T.ConeGeometry args={[w / 2, h, 24]} />
      <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.6} metalness={0.2} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.ConeGeometry args={[w / 2 + 0.02, h + 0.02, 24]} />
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2} />
      </T.Mesh>
    {/if}

  {:else if shapeType === 'roof'}
    <T.Mesh position={[0, h * 0.5, 0]}
      geometry={roofGeometry}
      onpointerdown={handlePointerDown}
      userData={{ pieceId: id, pieceClass: 'objeto' }}
    >
      <T.MeshStandardMaterial color={color} map={textureMap} roughness={0.6} metalness={0.2} />
    </T.Mesh>
    {#if networkState.activeTool === 'move'}
      <T.Mesh position={[0, h * 0.5, 0]}
        geometry={roofGeometry}
        onpointerdown={handlePointerDown}
        userData={{ pieceId: id, pieceClass: 'objeto' }}
      >
        <T.MeshBasicMaterial color="#ffffff" wireframe transparent opacity={0.2} />
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
        onpointermove={handleRotateMove}
        onpointerup={handleRotateEnd}
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
        onpointermove={handleElevMove}
        onpointerup={handleElevEnd}
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
        onpointermove={handleTransXMove}
        onpointerup={handleTransXEnd}
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
        onpointermove={handleTransZMove}
        onpointerup={handleTransZEnd}
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
