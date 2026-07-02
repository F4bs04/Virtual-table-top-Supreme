<script>
  import { T, useTask, useThrelte } from '@threlte/core';
  import { networkState } from '../networkState.svelte.js';
  import { loadSharedTexture } from '../textureCache.js';
  import { HTML } from '@threlte/extras';
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
  let animProgress = $state(1.0);
  const animDuration = 500; // ms (increased from 400ms for more grace)
  let animStartTime = 0;

  let activeTexture = $state(null);
  let defaultTexture = null;
  let isHovered = $state(false);
  let meshRef = $state(null);

  // Status textures loading
  let deadTexture = $state(null);
  let stunnedTexture = $state(null);

  $effect(() => {
    loadSharedTexture('/death_state.png', (tex) => {
      deadTexture = tex;
    });
    loadSharedTexture('/Stun_icon.png', (tex) => {
      stunnedTexture = tex;
    });
  });

  const pieceData = $derived(networkState.gameState.pieces[id]);
  const isDead = $derived(pieceData?.dead ?? false);
  const isStunned = $derived(pieceData?.stunned ?? false);
  const flipX = $derived(pieceData?.flipX ?? false);
  const isAnimated = $derived(
    textureUrl && (
      textureUrl.toLowerCase().endsWith('.gif') || 
      textureUrl.toLowerCase().endsWith('.webp') || 
      textureUrl.startsWith('data:image/gif') || 
      textureUrl.startsWith('data:image/webp')
    )
  );
  const customPartConfig = $derived(
    (networkState.gameState.customParticles || []).find(p => p.url === textureUrl)
  );
  const loopDuration = $derived(customPartConfig?.duration || 2000);
  
  let loopBuster = $state(0);
  $effect(() => {
    if (!isAnimated || !textureUrl) return;
    const interval = setInterval(() => {
      loopBuster += 1;
    }, loopDuration);
    return () => clearInterval(interval);
  });

  let canvasEl = $state(null);
  let imgEl = $state(null);
  let animatedTexture = $state(null);

  $effect(() => {
    if (isAnimated && canvasEl) {
      const tex = new THREE.CanvasTexture(canvasEl);
      tex.colorSpace = THREE.SRGBColorSpace;
      animatedTexture = tex;
      return () => {
        tex.dispose();
        animatedTexture = null;
      };
    }
  });

  const { camera } = useThrelte();

  // Visual effects and animation state
  let visualY = $state(0);
  let overlayColor = $state('#dddddd');
  let animationStart = $state(0);
  let animationType = $state(null);
  let dashElapsed = $state(0);
  let dashT = $state(0);

  const dashBlink = $derived(animationType === 'dash' && Math.floor(dashElapsed / 50) % 2 === 0);

  const ghost1T = $derived(Math.max(0, animProgress - 0.15));
  const ghost2T = $derived(Math.max(0, animProgress - 0.3));
  
  const ghost1Offset = $derived.by(() => {
    if (animationType !== 'dash') return { x: 0, z: 0 };
    const dx = lastTargetX - startX;
    const dz = lastTargetZ - startZ;
    const easeG1 = 1 - Math.pow(1 - ghost1T, 3);
    const easeT = 1 - Math.pow(1 - animProgress, 3);
    return {
      x: dx * (easeG1 - easeT),
      z: dz * (easeG1 - easeT)
    };
  });

  const ghost2Offset = $derived.by(() => {
    if (animationType !== 'dash') return { x: 0, z: 0 };
    const dx = lastTargetX - startX;
    const dz = lastTargetZ - startZ;
    const easeG2 = 1 - Math.pow(1 - ghost2T, 3);
    const easeT = 1 - Math.pow(1 - animProgress, 3);
    return {
      x: dx * (easeG2 - easeT),
      z: dz * (easeG2 - easeT)
    };
  });

  // Check if this piece is currently selected locally
  const isSelected = $derived(networkState.selectedPieceId === id);

  $effect(() => {
    const pObj = networkState.gameState.pieces[id];
    if (pObj && pObj.animationEffect && pObj.animationEffect.timestamp > animationStart) {
      animationStart = pObj.animationEffect.timestamp;
      animationType = pObj.animationEffect.type;
    }
  });

  let dragStartPos = null;

  useTask((delta) => {
    if (isAnimated && imgEl && canvasEl && animatedTexture) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.drawImage(imgEl, 0, 0, canvasEl.width, canvasEl.height);
        animatedTexture.needsUpdate = true;
      }
    }

    if (meshRef && camera.current) {
      meshRef.quaternion.copy(camera.current.quaternion);
    }

    if (networkState.gameState.gameModeActive) {
      currentX = x;
      currentY = y;
      currentZ = z;
      startX = x;
      startY = y;
      startZ = z;
      lastTargetX = x;
      lastTargetY = y;
      lastTargetZ = z;
      animProgress = 1.0;
      animationType = null;
      visualY = 0;
      overlayColor = isSelected ? '#ffffff' : '#dddddd';
      return;
    }

    if (animationType === 'dash') {
      dashElapsed = Date.now() - animationStart;
      dashT = Math.min(1.0, dashElapsed / 400);
    } else {
      dashElapsed = 0;
      dashT = 0;
    }

    const isDragging = networkState.draggedPieceId === id;

    if (isDragging) {
      if (!dragStartPos) {
        dragStartPos = { x: currentX, y: currentY, z: currentZ };
      }
      // Snap immediately during dragging to avoid sluggish hop or lagging behind cursor
      currentX = x;
      currentY = y;
      currentZ = z;
      startX = x;
      startY = y;
      startZ = z;
      lastTargetX = x;
      lastTargetY = y;
      lastTargetZ = z;
      animProgress = 1.0;
    } else {
      if (dragStartPos) {
        const releasedDragStart = dragStartPos;
        dragStartPos = null;
        if (networkState.role === 'host' && pieceClass !== 'personagem') {
          // Host drag already moved the token visually; do not replay a second hop on release.
          currentX = x;
          currentY = y;
          currentZ = z;
          startX = x;
          startY = y;
          startZ = z;
          lastTargetX = x;
          lastTargetY = y;
          lastTargetZ = z;
          animProgress = 1.0;
        } else {
          // Client drag waits for the authoritative move confirmation animation.
          startX = releasedDragStart.x;
          startY = releasedDragStart.y;
          startZ = releasedDragStart.z;
          currentX = releasedDragStart.x;
          currentY = releasedDragStart.y;
          currentZ = releasedDragStart.z;

          lastTargetX = x;
          lastTargetY = y;
          lastTargetZ = z;
          animProgress = 0.0;
          animStartTime = Date.now();
        }
      } else if (x !== lastTargetX || y !== lastTargetY || z !== lastTargetZ) {
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

        // Easing function: easeOutCubic (smoother and premium)
        const easeT = 1 - Math.pow(1 - t, 3);

        currentX = startX + (x - startX) * easeT;
        currentZ = startZ + (z - startZ) * easeT;

        // Hop height: parabolic arc — skip for dash animation (teleport)
        if (animationType === 'dash') {
          currentY = y; // instant position, no arc
        } else {
          const hopHeight = 0.45; // lower jump for visual elegance
          const hop = Math.sin(t * Math.PI) * hopHeight;
          currentY = startY + (y - startY) * easeT + hop;
        }
      } else {
        currentX = x;
        currentY = y;
        currentZ = z;
        startX = x;
        startY = y;
        startZ = z;
      }
    }

    if (animationType && animationStart > 0) {
      const elapsed = Date.now() - animationStart;
      const duration = animationType === 'dash' ? 400 : 750;

      if (elapsed >= duration) {
        animationType = null;
        visualY = 0;
        overlayColor = isSelected ? '#ffffff' : '#dddddd';
      } else {
        const t = elapsed / duration;
        if (animationType === 'damage') {
          visualY = Math.sin(t * Math.PI) * 0.9;
          overlayColor = `rgb(255, ${Math.floor(221 * t + (1 - t) * 40)}, ${Math.floor(221 * t + (1 - t) * 40)})`;
        } else if (animationType === 'heal') {
          visualY = Math.sin(t * Math.PI) * 0.9;
          overlayColor = `rgb(${Math.floor(221 * t + (1 - t) * 40)}, 255, ${Math.floor(221 * t + (1 - t) * 40)})`;
        } else if (animationType === 'dash') {
          // Flash white then fade in — teleport effect, no hop
          visualY = 0;
          // Phase 1 (0-0.4): flash bright white, piece fades out
          // Phase 2 (0.4-1.0): fade back to normal
          if (t < 0.4) {
            const flash = 1.0 - t / 0.4; // 1 → 0
            overlayColor = `rgb(${Math.floor(200 + 55 * flash)}, ${Math.floor(200 + 55 * flash)}, 255)`;
          } else {
            const fadeIn = (t - 0.4) / 0.6;
            overlayColor = `rgb(${Math.floor(221 * fadeIn)}, ${Math.floor(221 * fadeIn)}, ${Math.floor(255 * fadeIn)})`;
          }
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

  $effect(() => {
    defaultTexture = createDefaultAvatar(name, color, pieceClass === 'objeto');
    if (!textureUrl) {
      activeTexture = defaultTexture;
    }

    return () => {
      if (defaultTexture) defaultTexture.dispose();
    };
  });

  $effect(() => {
    if (textureUrl) {
      loadSharedTexture(
        textureUrl,
        (tex) => {
          activeTexture = tex;
        },
        (err) => {
          console.error(`Error loading texture for ${name}:`, err);
          activeTexture = defaultTexture;
        }
      );
    } else {
      activeTexture = defaultTexture;
    }
  });

  $effect(() => {
    if (!activeTexture) return;
    activeTexture.wrapS = THREE.RepeatWrapping;
    activeTexture.repeat.x = flipX ? -1 : 1;
    activeTexture.offset.x = flipX ? 1 : 0;
    activeTexture.needsUpdate = true;
  });

  // Handle Selection click with role-based authority rules
  function handlePointerDown(e) {
    if (e.button === undefined || e.button === 0) {
      // Left-click selects the token
      e.stopPropagation();
      if (networkState.role === 'client') {
        networkState.activeTool = 'move';
      }
      networkState.selectedPieceId = id;
      networkState.suppressNextGroundDeselect = true;
      networkState.dashMode = false;
      networkState.addLog(`Selecionado: ${name}. Clique no hex vermelho para mover.`);
    }
  }
</script>

<!-- Group to position the piece and its selection indicator -->
<T.Group position={[currentX, currentY, currentZ]} visible={isVisible && (pieceData?.visibleOnMap !== false)}>
  
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

  {#if isAnimated}
    {#key loopBuster}
      <img 
        bind:this={imgEl}
        src={textureUrl}
        alt="hidden asset"
        style="position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px; opacity: 0;"
      />
    {/key}
    <canvas 
      bind:this={canvasEl}
      width={256}
      height={256}
      style="display: none;"
    ></canvas>
  {/if}

  <!-- Interactive Billboard Group -->
  <T.Group bind:ref={meshRef}>
    {#if isAnimated && canvasEl}
      <!-- Animated Mesh -->
      <T.Mesh 
        scale={[(isHovered ? 1.4 : 1.2) * scale * (flipX ? -1 : 1), (isHovered ? 1.4 : 1.2) * scale, 1]}
        position={[0, (0.6 + visualY) * scale, 0]}
        onpointerdown={handlePointerDown}
        onpointerover={() => { isHovered = true; }}
        onpointerout={() => { isHovered = false; }}
        userData={{ pieceId: id, pieceClass }}
      >
        <T.PlaneGeometry args={[1, 1]} />
        <T.MeshBasicMaterial 
          map={animatedTexture}
          color={overlayColor}
          transparent={true}
          alphaTest={currentAlphaTest}
          opacity={opacityMultiplier * (dashBlink ? 0.25 : 1.0)}
          side={THREE.DoubleSide}
        />
      </T.Mesh>
    {/if}

    {#if !isAnimated && activeTexture}
      <!-- Main Mesh -->
      <T.Mesh 
        scale={[(isHovered ? 1.4 : 1.2) * scale, (isHovered ? 1.4 : 1.2) * scale, 1]}
        position={[0, (0.6 + visualY) * scale, 0]}
        onpointerdown={handlePointerDown}
        onpointerover={() => { isHovered = true; }}
        onpointerout={() => { isHovered = false; }}
        userData={{ pieceId: id, pieceClass }}
      >
        <T.PlaneGeometry args={[1, 1]} />
        <T.MeshBasicMaterial 
          map={activeTexture}
          color={overlayColor}
          transparent={true}
          alphaTest={currentAlphaTest}
          opacity={opacityMultiplier * (dashBlink ? 0.25 : 1.0)}
          side={THREE.DoubleSide}
        />
      </T.Mesh>

      <!-- Ghost 1 (Afterimage) -->
      {#if animationType === 'dash' && animProgress < 0.95 && animProgress > 0.05 && !networkState.gameState.gameModeActive}
        <T.Mesh 
          scale={[1.2 * scale, 1.2 * scale, 1]}
          position={[ghost1Offset.x, 0.6 * scale, ghost1Offset.z]}
        >
          <T.PlaneGeometry args={[1, 1]} />
          <T.MeshBasicMaterial 
            map={activeTexture}
            color="#22d3ee"
            transparent={true}
            alphaTest={currentAlphaTest}
            opacity={opacityMultiplier * 0.45 * (1.0 - animProgress)}
            side={THREE.DoubleSide}
          />
        </T.Mesh>
      {/if}

      <!-- Ghost 2 (Afterimage) -->
      {#if animationType === 'dash' && animProgress < 0.85 && animProgress > 0.15 && !networkState.gameState.gameModeActive}
        <T.Mesh 
          scale={[1.2 * scale, 1.2 * scale, 1]}
          position={[ghost2Offset.x, 0.6 * scale, ghost2Offset.z]}
        >
          <T.PlaneGeometry args={[1, 1]} />
          <T.MeshBasicMaterial 
            map={activeTexture}
            color="#a855f7"
            transparent={true}
            alphaTest={currentAlphaTest}
            opacity={opacityMultiplier * 0.25 * (1.0 - animProgress)}
            side={THREE.DoubleSide}
          />
        </T.Mesh>
      {/if}
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
