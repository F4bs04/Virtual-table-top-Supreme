<script>
  import { T, useTask, useThrelte } from '@threlte/core';
  import { networkState } from '../networkState.svelte.js';
  import * as THREE from 'three';

  // Svelte 5 Props
  let { 
    id, 
    name, 
    pieceClass, // 'personagem' | 'objeto'
    x, 
    y, 
    z, 
    hexX,
    hexZ,
    color, 
    textureUrl,
    scale = 1.0
  } = $props();

  let currentX = $state(x);
  let currentY = $state(y);
  let currentZ = $state(z);

  let startX = x;
  let startY = y;
  let startZ = z;
  let lastTargetX = x;
  let lastTargetY = y;
  let lastTargetZ = z;
  let animProgress = 1.0;
  const animDuration = 400; // ms
  let animStartTime = 0;

  let activeTexture = $state(null);
  let defaultTexture = null;
  let isHovered = $state(false);
  let meshRef = $state(null);

  // Status textures loading
  let deadTexture = $state(null);
  let stunnedTexture = $state(null);

  $effect(() => {
    const loader = new THREE.TextureLoader();
    loader.load('/death_state.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      deadTexture = tex;
    });
    loader.load('/Stun_icon.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      stunnedTexture = tex;
    });
  });

  const pieceData = $derived(networkState.gameState.pieces[id]);
  const isDead = $derived(pieceData?.dead ?? false);
  const isStunned = $derived(pieceData?.stunned ?? false);
  const flipX = $derived(pieceData?.flipX ?? false);

  const { camera } = useThrelte();

  // Visual effects and animation state
  let visualY = $state(0);
  let overlayColor = $state('#dddddd');
  let animationStart = $state(0);
  let animationType = $state(null);

  // Check if this piece is currently selected locally
  const isSelected = $derived(networkState.selectedPieceId === id);

  $effect(() => {
    const pObj = networkState.gameState.pieces[id];
    if (pObj && pObj.animationEffect && pObj.animationEffect.timestamp > animationStart) {
      animationStart = pObj.animationEffect.timestamp;
      animationType = pObj.animationEffect.type;
    }
  });

  useTask((delta) => {
    if (meshRef && camera.current) {
      meshRef.quaternion.copy(camera.current.quaternion);
    }

    // Detect target changes directly in the frame loop (no Svelte effect dependency issues)
    if (x !== lastTargetX || y !== lastTargetY || z !== lastTargetZ) {
      startX = currentX;
      startY = currentY;
      startZ = currentZ;
      lastTargetX = x;
      lastTargetY = y;
      lastTargetZ = z;
      animProgress = 0.0;
      animStartTime = Date.now();
    }

    if (animProgress < 1.0) {
      const elapsed = Date.now() - animStartTime;
      const t = Math.min(1.0, elapsed / animDuration);
      animProgress = t;

      // Easing function: easeOutQuad
      const easeT = t * (2 - t);

      currentX = startX + (x - startX) * easeT;
      currentZ = startZ + (z - startZ) * easeT;

      // Hop height: parabolic arc peaking at t=0.5
      const hopHeight = 0.8;
      const hop = Math.sin(t * Math.PI) * hopHeight;
      currentY = startY + (y - startY) * easeT + hop;
    } else {
      currentX = x;
      currentY = y;
      currentZ = z;
      startX = x;
      startY = y;
      startZ = z;
    }

    if (animationType && animationStart > 0) {
      const elapsed = Date.now() - animationStart;
      const duration = 750;
      if (elapsed >= duration) {
        animationType = null;
        visualY = 0;
        overlayColor = isSelected ? '#ffffff' : '#dddddd';
      } else {
        const t = elapsed / duration;
        visualY = Math.sin(t * Math.PI) * 0.9;
        if (animationType === 'damage') {
          overlayColor = `rgb(255, ${Math.floor(221 * t + (1 - t) * 40)}, ${Math.floor(221 * t + (1 - t) * 40)})`;
        } else if (animationType === 'heal') {
          overlayColor = `rgb(${Math.floor(221 * t + (1 - t) * 40)}, 255, ${Math.floor(221 * t + (1 - t) * 40)})`;
        }
      }
    } else {
      visualY = 0;
      overlayColor = isSelected ? '#ffffff' : '#dddddd';
    }
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
  const currentAlphaTest = $derived(opacityMultiplier < 0.9 ? 0.05 : 0.5);


  // Generate a beautiful procedural token avatar as a fallback
  function createDefaultAvatar(name, color, isObject) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    if (isObject) {
      // Draw a glowing diamond structure for objects
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(128, 20);
      ctx.lineTo(220, 128);
      ctx.lineTo(128, 236);
      ctx.lineTo(36, 128);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 8;
      ctx.stroke();
    } else {
      // Draw a circular token for characters
      // Outer glow
      const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 120);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(128, 128, 120, 0, Math.PI * 2);
      ctx.fill();

      // Inner disc
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(128, 128, 80, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(128, 128, 80, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Name initials
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 75px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    ctx.fillText(initials, 128, 128);

    // Label at bottom
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Courier New", sans-serif';
    ctx.fillText(name, 128, 220);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // Effect to manage default texture creation
  $effect(() => {
    defaultTexture = createDefaultAvatar(name, color, pieceClass === 'objeto');
    if (!textureUrl) {
      activeTexture = defaultTexture;
    }

    return () => {
      if (defaultTexture) defaultTexture.dispose();
    };
  });

  // Effect to load custom textureUrl reactively when updated by Host
  $effect(() => {
    if (textureUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        textureUrl,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          activeTexture = tex;
        },
        undefined,
        (err) => {
          console.error(`Error loading texture for ${name}:`, err);
          activeTexture = defaultTexture;
        }
      );
    } else {
      activeTexture = defaultTexture;
    }
  });

  // Handle Selection click with role-based authority rules
  function handlePointerDown(e) {
    e.stopPropagation(); // Avoid clicking the ground beneath

    const buildMode = networkState.gameState.buildMode;

    if (pieceClass === 'personagem') {
      if (buildMode) {
        networkState.addLog(`BLOCKED: Cannot select or move characters while Build Mode is active.`);
        return;
      }
      // Rule: Anyone can move character pieces when Build Mode is OFF
      networkState.selectedPieceId = id;
      networkState.draggedPieceId = id;
      networkState.draggedPieceStartHex = { c: hexX, r: hexZ };
      networkState.addLog(`Selected character: ${name}. Drag to move or adjust height in panel.`);
    } else if (pieceClass === 'objeto') {
      if (!buildMode) {
        networkState.addLog(`Selected object: ${name}. Enable Build Mode as GM to select and move structures.`);
        return;
      }
      networkState.selectedPieceId = id;
      if (networkState.role === 'host') {
        if (networkState.activeTool === 'move') {
          networkState.draggedPieceId = id;
          networkState.draggedPieceStartHex = { c: hexX, r: hexZ };
          networkState.addLog(`Selected object: ${name} (Build Mode Active). Drag to move.`);
        } else {
          networkState.addLog(`Selected object: ${name}. Select the Move Tool (🎯 Move) in the toolbar to drag.`);
        }
      } else {
        networkState.addLog(`Selected object: ${name}. Only the GM can move structures in Build Mode.`);
      }
    }
  }
</script>

<!-- Group to position the piece and its selection indicator -->
<T.Group position={[currentX, currentY, currentZ]} visible={isVisible}>
  
  <!-- Pulsing Selection Base Ring (rendered flat on floor Y=0) -->
  {#if isSelected}
    <T.Mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <T.RingGeometry args={[0.5, 0.6, 32]} />
      <T.MeshBasicMaterial 
        color={color} 
        side={THREE.DoubleSide} 
        transparent={true}
        opacity={(0.8 + Math.sin(Date.now() * 0.005) * 0.2) * opacityMultiplier} 
      />
    </T.Mesh>
  {/if}

  <!-- Floating Bouncing Selection Arrow -->
  {#if isSelected && pieceClass === 'personagem'}
    <T.Mesh 
      position={[0, (2.2 + Math.sin(Date.now() * 0.007) * 0.12 + visualY) * scale, 0]} 
      rotation={[Math.PI, Date.now() * 0.003, 0]}
    >
      <T.ConeGeometry args={[0.16 * scale, 0.38 * scale, 5]} />
      <T.MeshBasicMaterial 
        color={color} 
        transparent={true} 
        opacity={opacityMultiplier} 
      />
    </T.Mesh>
  {/if}

  <!-- Interactive Billboard Group -->
  <T.Group bind:ref={meshRef}>
    {#if activeTexture}
      <T.Mesh 
        scale={[(isHovered ? 1.4 : 1.2) * scale * (flipX ? -1 : 1), (isHovered ? 1.4 : 1.2) * scale, 1]}
        position={[0, (0.6 + visualY) * scale, 0]}
        onpointerdown={handlePointerDown}
        onpointerover={() => { isHovered = true; }}
        onpointerout={() => { isHovered = false; }}
      >
        <T.PlaneGeometry args={[1, 1]} />
        <T.MeshBasicMaterial 
          map={activeTexture}
          color={overlayColor}
          transparent={true}
          alphaTest={currentAlphaTest}
          opacity={opacityMultiplier}
          side={THREE.DoubleSide}
        />
      </T.Mesh>
    {/if}

    <!-- Status Icons hovering above character token -->
    {#if pieceClass === 'personagem'}
      {#if isDead && isStunned}
        <!-- Render both side-by-side above character token -->
        {#if deadTexture}
          <T.Mesh position={[-0.22 * scale, (1.35 + visualY) * scale, 0.01]} scale={[0.35 * scale, 0.35 * scale, 1]}>
            <T.PlaneGeometry args={[1, 1]} />
            <T.MeshBasicMaterial 
              map={deadTexture} 
              transparent={true} 
              opacity={opacityMultiplier} 
              side={THREE.DoubleSide}
              alphaTest={0.05}
            />
          </T.Mesh>
        {/if}
        {#if stunnedTexture}
          <T.Mesh position={[0.22 * scale, (1.35 + visualY) * scale, 0.01]} scale={[0.35 * scale, 0.35 * scale, 1]}>
            <T.PlaneGeometry args={[1, 1]} />
            <T.MeshBasicMaterial 
              map={stunnedTexture} 
              transparent={true} 
              opacity={opacityMultiplier} 
              side={THREE.DoubleSide}
              alphaTest={0.05}
            />
          </T.Mesh>
        {/if}
      {:else if isDead}
        {#if deadTexture}
          <T.Mesh position={[0, (1.35 + visualY) * scale, 0.01]} scale={[0.4 * scale, 0.4 * scale, 1]}>
            <T.PlaneGeometry args={[1, 1]} />
            <T.MeshBasicMaterial 
              map={deadTexture} 
              transparent={true} 
              opacity={opacityMultiplier} 
              side={THREE.DoubleSide}
              alphaTest={0.05}
            />
          </T.Mesh>
        {/if}
      {:else if isStunned}
        {#if stunnedTexture}
          <T.Mesh position={[0, (1.35 + visualY) * scale, 0.01]} scale={[0.4 * scale, 0.4 * scale, 1]}>
            <T.PlaneGeometry args={[1, 1]} />
            <T.MeshBasicMaterial 
              map={stunnedTexture} 
              transparent={true} 
              opacity={opacityMultiplier} 
              side={THREE.DoubleSide}
              alphaTest={0.05}
            />
          </T.Mesh>
        {/if}
      {/if}
    {/if}
  </T.Group>
</T.Group>
