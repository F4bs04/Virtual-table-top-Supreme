<script>
  import { Canvas } from '@threlte/core';
  import { networkState } from '../networkState.svelte.js';
  import Scene from './Scene.svelte';

  // Clear active selection / cancel drawing when Escape is pressed
  $effect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
          return;
        }
        e.preventDefault();
        networkState.undo();
        return;
      }

      if (e.key === 'Escape') {
        if (networkState.drawingMode) {
          if (networkState.activeTool === 'draw-floor') {
            networkState.floorDrawingPoints = [];
            networkState.drawingStartHex = null;
            networkState.drawingMode = false;
            networkState.activeTool = 'hand';
            networkState.addLog('Floor drawing cancelled (ESC).');
          } else if (networkState.drawingStartHex !== null) {
            networkState.drawingStartHex = null;
            networkState.addLog('Wall chain stopped (ESC). Click to start a new wall or press ESC again to exit draw mode.');
          } else {
            networkState.drawingMode = false;
            networkState.activeTool = 'hand';
            networkState.addLog('Draw mode exited (ESC). Camera hand tool active.');
          }
        } else {
          networkState.dashMode = false;
          networkState.moveLockPieceId = null;
          networkState.selectedPieceId = null;
          networkState.addLog('Selection cancelled (ESC).');
        }
      } else if (e.key === 'Enter') {
        if (networkState.drawingMode && networkState.activeTool === 'draw-floor' && networkState.floorDrawingPoints.length >= 4) {
          networkState.addDrawnFloorPolygon(networkState.floorDrawingPoints);
          networkState.floorDrawingPoints = [];
          networkState.drawingStartHex = null;
          networkState.drawingMode = false;
          networkState.activeTool = 'hand';
          networkState.addLog('Floor polygon completed via Enter key!');
        }
      }
    }

    function handleContextMenu(e) {
      e.preventDefault();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  });

  let showSelectionFeedback = $state(false);
  let feedbackTimeout = null;

  $effect(() => {
    if (networkState.selectedPieceId !== null) {
      showSelectionFeedback = true;
      if (feedbackTimeout) clearTimeout(feedbackTimeout);
      feedbackTimeout = setTimeout(() => {
        showSelectionFeedback = false;
      }, 4000);
    } else {
      showSelectionFeedback = false;
    }
    return () => {
      if (feedbackTimeout) clearTimeout(feedbackTimeout);
    };
  });

  $effect(() => {
    if (networkState.role === 'client' && networkState.activeTool !== 'hand') {
      networkState.activeTool = 'hand';
      networkState.drawingMode = false;
      networkState.drawingStartHex = null;
    }
  });

  // Watch for new rolls to trigger a floating banner
  let lastRollId = $state('');
  let activeRollBanner = $state(null); // { name, die, result }
  let rollBannerTimeout = null;

  $effect(() => {
    const rolls = networkState.gameState.recentRolls || [];
    if (rolls.length > 0) {
      const latest = rolls[0];
      if (latest.id !== lastRollId) {
        lastRollId = latest.id;
        activeRollBanner = latest;
        if (rollBannerTimeout) clearTimeout(rollBannerTimeout);
        rollBannerTimeout = setTimeout(() => {
          activeRollBanner = null;
        }, 4000); // Display for 4 seconds
      }
    }
  });

  let showInstruction = $state(true);

  // Reset instruction visibility when selected piece or tool changes
  $effect(() => {
    const _tool = networkState.activeTool;
    const _selId = networkState.selectedPieceId;
    showInstruction = true;
  });

</script>

<div class="vtt-board-container">
  <!-- Instruction Overlay -->
  {#if showInstruction}
    <div class="board-overlay">
      {#if networkState.selectedPieceId !== null && !networkState.drawingMode && showSelectionFeedback}
        <div class="overlay-badge pulse">
          PIECE SELECTED // CLICK RED HEX TO MOVE
          <button 
            class="close-overlay-btn" 
            onclick={(e) => { e.stopPropagation(); showInstruction = false; }} 
            title="Fechar instruções"
          >✕</button>
        </div>
      {:else}
        <div class="overlay-badge {networkState.drawingMode ? 'draw-mode' : ''}">
          {#if networkState.activeTool === 'hand'}
            LEFT DRAG TO PAN // RIGHT DRAG TO ROTATE // WHEEL TO ZOOM
          {:else if networkState.activeTool === 'move'}
            SELECT A PIECE // CLICK RED HEX TO MOVE
          {:else if networkState.activeTool === 'select'}
            CLICK A PIECE TO SELECT IT // NO MOVEMENT ALLOWED
          {:else if networkState.activeTool === 'particles'}
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; vertical-align: middle;">
              <span>✨ Efeito:</span>
              <select 
                value={networkState.activeParticleType || 'burst'} 
                onchange={(e) => { networkState.activeParticleType = e.target.value; }}
                style="background: rgba(0, 0, 0, 0.75); border: 1px solid rgba(255, 255, 255, 0.25); color: #fff; padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.75rem; cursor: pointer; outline: none; font-family: inherit;"
              >
                <option value="burst">Reiatsu Wave (Onda)</option>
                <option value="falling">Partículas Caindo (Chuva)</option>
                <option value="bubbles">Esferas Ascendentes (Bolinhas)</option>
                <option value="lightning">Raios Espirituais (Raios)</option>
                <option value="light">Explosão de Luz (Luz)</option>
              </select>
              <span style="opacity: 0.8; font-size: 0.75rem;">// CLIQUE NA GRADE PARA DETONAR</span>
            </div>
          {:else if networkState.activeTool === 'draw-wall'}
            {#if networkState.drawingStartHex === null}
              🧱 CLICK TO SET WALL START POINT
            {:else}
              🧱 CLICK TO PLACE WALL SEGMENT // ESC TO STOP CHAIN
            {/if}
          {:else if networkState.activeTool === 'draw-floor'}
            {#if networkState.floorDrawingPoints && networkState.floorDrawingPoints.length > 0}
              🗺️ CLIQUE NOS VÉRTICES (PONTOS: {networkState.floorDrawingPoints.length}) // CLIQUE NO PRIMEIRO PONTO PARA FECHAR // ENTER OU ESC PARA CONCLUIR/CANCELAR
            {:else}
              🗺️ CLIQUE NA GRADE PARA DEFINIR O PRIMEIRO VÉRTICE DO CHÃO (MÍNIMO 4 VÉRTICES)
            {/if}
          {/if}
          <button 
            class="close-overlay-btn" 
            onclick={(e) => { e.stopPropagation(); showInstruction = false; }} 
            title="Fechar instruções"
          >✕</button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- GM Floating Toolbar -->
  {#if networkState.role === 'host'}
    <div class="gm-toolbar">
      <div class="toolbar-title">GM TOOLS</div>
      
      <button 
        class="tool-btn {networkState.activeTool === 'hand' ? 'active' : ''}" 
        onclick={() => { 
          networkState.activeTool = 'hand'; 
          networkState.drawingMode = false; 
          networkState.drawingStartHex = null;
          networkState.addLog('Hand tool activated (Camera controls enabled)');
        }}
        title="Camera Hand Tool (Move Camera)"
      >
        <span class="tool-icon">✋</span>
        <span class="tool-label">Camera</span>
      </button>
      
      <button 
        class="tool-btn {networkState.activeTool === 'move' ? 'active' : ''}" 
        onclick={() => { 
          networkState.activeTool = 'move'; 
          networkState.drawingMode = false; 
          networkState.drawingStartHex = null;
          networkState.addLog('Move Tool activated (Select then click destination to reposition)');
        }}
        title="Move Tool (Reposition pieces)"
      >
        <span class="tool-icon">🎯</span>
        <span class="tool-label">Move</span>
      </button>

      <button 
        class="tool-btn {networkState.activeTool === 'select' ? 'active' : ''}" 
        onclick={() => { 
          networkState.activeTool = 'select'; 
          networkState.drawingMode = false; 
          networkState.drawingStartHex = null;
          networkState.addLog('Select Tool activated (Click to select pieces without moving them)');
        }}
        title="Select Tool (Click to select pieces)"
      >
        <span class="tool-icon">🔍</span>
        <span class="tool-label">Select</span>
      </button>

      <button 
        class="tool-btn {networkState.activeTool === 'particles' ? 'active' : ''}" 
        onclick={() => { 
          networkState.activeTool = 'particles'; 
          networkState.drawingMode = false; 
          networkState.drawingStartHex = null;
          networkState.addLog('Particles Tool active: Click grid cells to trigger a spiritual wave!');
        }}
        title="Spiritual REIATSUBURST Particles Tool"
      >
        <span class="tool-icon">✨</span>
        <span class="tool-label">Particles</span>
      </button>

      <div class="toolbar-divider"></div>

      <button 
        class="tool-btn {networkState.activeTool === 'draw-wall' ? 'active draw-active' : ''}" 
        onclick={() => { 
          networkState.activeTool = 'draw-wall'; 
          networkState.drawingMode = true; 
          networkState.drawingStructureType = 'wall-line';
          networkState.drawingStartHex = null;
          networkState.addLog('Wall Tool active: Click to set start, click again for end (chains automatically)');
        }}
        title="Draw Wall Line (Sims-style chaining)"
      >
        <span class="tool-icon">🧱</span>
        <span class="tool-label">Wall</span>
      </button>

      <button 
        class="tool-btn {networkState.activeTool === 'draw-floor' ? 'active' : ''}" 
        onclick={() => { 
          networkState.activeTool = 'draw-floor'; 
          networkState.drawingMode = true; 
          networkState.drawingStructureType = 'floor-plane';
          networkState.drawingStartHex = null;
          networkState.addLog('Floor Tool active: Click grid cells to draw floor plane');
        }}
        title="Draw Floor Plane"
      >
        <span class="tool-icon">🗺️</span>
        <span class="tool-label">Floor</span>
      </button>

      <!-- Stop drawing button (only shown while chaining walls) -->
      {#if networkState.drawingMode && networkState.activeTool === 'draw-wall' && networkState.drawingStartHex !== null}
        <button 
          class="tool-btn stop-btn" 
          onclick={() => { 
            networkState.drawingStartHex = null;
            networkState.addLog('Wall chain stopped. Click Wall tool to start a new wall.');
          }}
          title="Stop chaining walls at current point"
        >
          <span class="tool-icon">⏹️</span>
          <span class="tool-label">Stop</span>
        </button>
      {/if}

      <!-- Stop / Close floor drawing button -->
      {#if networkState.drawingMode && networkState.activeTool === 'draw-floor' && networkState.floorDrawingPoints.length >= 4}
        <button 
          class="tool-btn stop-btn" 
          onclick={() => { 
            networkState.addDrawnFloorPolygon(networkState.floorDrawingPoints);
            networkState.floorDrawingPoints = [];
            networkState.drawingStartHex = null;
            networkState.drawingMode = false;
            networkState.activeTool = 'hand';
            networkState.addLog('Floor polygon completed!');
          }}
          title="Close and complete floor polygon"
          style="background: #22c55e;"
        >
          <span class="tool-icon">✅</span>
          <span class="tool-label">Concluir</span>
        </button>
      {/if}

      <div class="toolbar-divider"></div>

      <!-- Delete selected piece button -->
      {#if networkState.selectedPieceId !== null}
        <button 
          class="tool-btn delete-btn" 
          onclick={() => { 
            const id = networkState.selectedPieceId;
            if (id) networkState.deletePiece(id);
          }}
          title="Delete selected piece"
        >
          <span class="tool-icon">🗑️</span>
          <span class="tool-label">Delete</span>
        </button>
      {/if}
    </div>
  {/if}

  <!-- Threlte 3D Canvas -->
  <Canvas>
    <Scene />
  </Canvas>

  <!-- Fullscreen Shared Image Overlay -->
  {#if networkState.gameState.activePopupImage}
    <div class="fullscreen-popup-overlay fade-in">
      <div class="popup-card">
        <button class="popup-close-btn" onclick={() => {
          if (networkState.role === 'host') {
            networkState.clearPopupImage();
          } else {
            const overlay = document.querySelector('.fullscreen-popup-overlay');
            if (overlay) overlay.style.display = 'none';
          }
        }}>✕ Fechar</button>
        <img src={networkState.gameState.activePopupImage} alt="VTT Shared Image" class="popup-image" />
      </div>
    </div>
  {/if}

  <!-- Floating Turn Indicator -->
  {#if networkState.gameState.turnPhase === 'active' && networkState.gameState.turnOrder.length > 0}
    {@const currentEntry = networkState.gameState.turnOrder[networkState.gameState.currentTurnIndex]}
    <div class="turn-indicator" style="position: absolute; bottom: 1rem; right: 1rem; z-index: 5000; pointer-events: none;">
      <div style="background: rgba(15, 23, 42, 0.94); border: 1.5px solid #f59e0b; border-radius: 12px; padding: 0.75rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(245, 158, 11, 0.25); backdrop-filter: blur(10px); min-width: 110px; text-align: center;">
        <span style="font-size: 0.65rem; font-weight: 900; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.08rem; font-family: monospace;">TURNO</span>
        {#if currentEntry.textureUrl}
          <img src={currentEntry.textureUrl} alt={currentEntry.name} style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);" />
        {:else}
          <div style="width: 48px; height: 48px; border-radius: 50%; background: {currentEntry.color}; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; font-weight: 900; color: #fff; border: 2px solid #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);">
            {currentEntry.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        {/if}
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.15rem;">
          <strong style="font-size: 0.85rem; color: #fbbf24; line-height: 1.2; word-break: break-word; max-width: 120px; font-weight: 700;">{currentEntry.name}</strong>
          <span style="font-size: 0.6rem; color: #94a3b8; font-family: monospace;">({networkState.gameState.currentTurnIndex + 1}/{networkState.gameState.turnOrder.length})</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Floating Dice Roll Banner -->
  {#if activeRollBanner}
    <div class="floating-roll-banner slide-down" onclick={() => activeRollBanner = null} style="cursor: pointer;" title="Clique para fechar">
      <div class="roll-banner-content" style="position: relative; padding-right: 2rem;">
        <span class="roll-die-icon">🎲</span>
        <span class="roll-banner-text">
          <strong>{activeRollBanner.name}</strong> rolou <strong>{activeRollBanner.die}</strong>:
        </span>
        <span class="roll-result-badge">{activeRollBanner.result}</span>
        <button 
          onclick={(e) => { e.stopPropagation(); activeRollBanner = null; }} 
          style="background: none; border: none; color: rgba(255,255,255,0.4); font-size: 0.8rem; font-weight: bold; cursor: pointer; position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); transition: color 0.2s;"
          onmouseover={(e) => e.target.style.color = '#fff'}
          onmouseout={(e) => e.target.style.color = 'rgba(255,255,255,0.4)'}
          title="Fechar"
        >
          ✕
        </button>
      </div>
    </div>
  {/if}
</div>



<style>
  .vtt-board-container {
    width: 100%;
    height: 100%;
    background: #090514; /* Deep void background */
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    position: relative;
    overflow: hidden;
    touch-action: none;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
  }

  .board-overlay {
    position: absolute;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: none;
  }

  .overlay-badge {
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #a855f7;
    padding: 0.5rem 1.25rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    letter-spacing: 0.1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    pointer-events: auto; /* Allow clicking the close button */
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .close-overlay-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #94a3b8;
    margin-left: 0.5rem;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.85rem;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: all 0.2s;
  }

  .close-overlay-btn:hover {
    color: #fff;
    background: #ef4444;
    border-color: #ef4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  }

  .overlay-badge.pulse {
    border-color: #06b6d4;
    color: #22d3ee;
    animation: badgePulse 1.5s infinite;
  }

  @keyframes badgePulse {
    0% { transform: scale(1); box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2); }
    50% { transform: scale(1.03); box-shadow: 0 4px 20px rgba(6, 182, 212, 0.5); }
    100% { transform: scale(1); box-shadow: 0 4px 12px rgba(6, 182, 212, 0.2); }
  }

  .overlay-badge.draw-mode {
    border-color: rgba(168, 85, 247, 0.7);
    color: #c084fc;
    background: rgba(88, 28, 135, 0.5);
    animation: drawBadgePulse 1s ease-in-out infinite;
  }

  @keyframes drawBadgePulse {
    0% { border-color: rgba(168, 85, 247, 0.5); }
    50% { border-color: rgba(168, 85, 247, 1.0); box-shadow: 0 4px 18px rgba(168, 85, 247, 0.6); }
    100% { border-color: rgba(168, 85, 247, 0.5); }
  }

  .gm-toolbar {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(168, 85, 247, 0.25);
    padding: 0.75rem 0.5rem;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .toolbar-title {
    font-size: 0.65rem;
    font-weight: 900;
    letter-spacing: 0.1rem;
    color: #a855f7;
    text-align: center;
    margin-bottom: 0.35rem;
    font-family: monospace;
  }

  .toolbar-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0.25rem 0;
  }

  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tool-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .tool-btn.active {
    background: rgba(168, 85, 247, 0.2);
    border-color: #a855f7;
    color: #fff;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
  }

  .tool-icon {
    font-size: 1.25rem;
    margin-bottom: 0.15rem;
  }

  .tool-label {
    font-size: 0.65rem;
    font-weight: 600;
  }

  /* Wall tool actively chaining — animated border to indicate live state */
  .tool-btn.draw-active {
    background: rgba(168, 85, 247, 0.25);
    border-color: #a855f7;
    color: #fff;
    animation: drawPulse 1.2s ease-in-out infinite;
    box-shadow: 0 0 14px rgba(168, 85, 247, 0.5);
  }

  @keyframes drawPulse {
    0% { box-shadow: 0 0 8px rgba(168, 85, 247, 0.4); }
    50% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.8); }
    100% { box-shadow: 0 0 8px rgba(168, 85, 247, 0.4); }
  }

  .tool-btn.stop-btn {
    background: rgba(249, 115, 22, 0.15);
    border-color: rgba(249, 115, 22, 0.5);
    color: #fb923c;
  }

  .tool-btn.stop-btn:hover {
    background: rgba(249, 115, 22, 0.3);
    border-color: #f97316;
    color: #fff;
  }

  .tool-btn.delete-btn {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  .tool-btn.delete-btn:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: #ef4444;
    color: #fff;
  }

  /* Fullscreen popup image shared overlay */
  .fullscreen-popup-overlay {
    position: absolute;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(15px);
  }

  .popup-card {
    position: relative;
    max-width: 90%;
    max-height: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .popup-image {
    max-width: 100%;
    max-height: 80vh;
    border-radius: 12px;
    border: 3px solid rgba(168, 85, 247, 0.4);
    box-shadow: 0 10px 40px rgba(0,0,0,0.8);
    object-fit: contain;
  }

  .popup-close-btn {
    position: absolute;
    top: -45px;
    right: 0;
    background: rgba(239, 68, 68, 0.85);
    border: 1px solid #ef4444;
    color: #fff;
    padding: 0.4rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    transition: all 0.2s;
  }
  .popup-close-btn:hover {
    background: #ef4444;
    transform: scale(1.05);
  }

  /* Floating roll banner */
  .floating-roll-banner {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5000;
    pointer-events: none;
  }

  .roll-banner-content {
    background: rgba(15, 23, 42, 0.95);
    border: 1.5px solid #06b6d4;
    color: #f1f5f9;
    padding: 0.65rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 256, 256, 0.25);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: monospace;
    font-size: 0.85rem;
  }

  .roll-die-icon {
    font-size: 1.2rem;
    animation: dieRotate 1s ease-in-out infinite alternate;
  }

  @keyframes dieRotate {
    0% { transform: rotate(-15deg); }
    100% { transform: rotate(15deg); }
  }

  .roll-result-badge {
    background: linear-gradient(135deg, #06b6d4, #a855f7);
    color: #fff;
    font-size: 1.25rem;
    font-weight: 900;
    padding: 0.25rem 0.65rem;
    border-radius: 8px;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    box-shadow: 0 0 10px rgba(6, 182, 212, 0.5);
    animation: bounce 0.5s ease-out;
  }

  .fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .slide-down {
    animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes slideDown {
    from { transform: translate(-50%, 50px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }
</style>
