<script>
  import { networkState } from '../networkState.svelte.js';

  let customHostId = $state('');
  let targetRoomId = $state('');
  let showCopied = $state(false);

  // Piece Creator state
  let newPieceName = $state('');
  let newPieceClass = $state('personagem'); // 'personagem' | 'objeto'
  let newPieceColor = $state('#ff3e00');
  let inspectorName = $state('');
  let inspectorClass = $state('personagem');
  let inspectorColor = $state('#ffffff');
  let houseName = $state('Safe House');
  let houseShape = $state('box');
  let houseWidth = $state(4);
  let houseDepth = $state(4);
  let houseFloors = $state(2);
  let houseColor = $state('#475569');
  let activeTab = $state('tokens'); // 'map' | 'tokens' | 'logs'

  const selectedPiece = $derived.by(() => {
    if (!networkState.selectedPieceId) return null;
    return networkState.gameState.pieces[networkState.selectedPieceId] ?? null;
  });

  const accessibleHouse = $derived.by(() => {
    if (!selectedPiece || selectedPiece.class !== 'personagem') return null;
    return networkState.getHouseContainingPiece(selectedPiece.id);
  });

  const structurePresets = [
    { name: 'Reishi Wall', color: '#64748b', description: 'Bloqueio e cobertura' },
    { name: 'Senkaimon Gate', color: '#f59e0b', description: 'Portal / entrada' },
    { name: 'Barrier Node', color: '#06b6d4', description: 'Defesa espiritual' },
    { name: 'Training Platform', color: '#a855f7', description: 'Elevação / arena' },
    { name: 'Supply Shrine', color: '#22c55e', description: 'Objetivo / recurso' },
    { name: 'Hazard Zone', color: '#ef4444', description: 'Perigo de cenário' }
  ];

  $effect(() => {
    if (!selectedPiece) return;
    inspectorName = selectedPiece.name;
    inspectorClass = selectedPiece.class;
    inspectorColor = selectedPiece.color;
  });

  function submitNewPiece() {
    if (!newPieceName.trim()) return;
    networkState.addPiece(newPieceName.trim(), newPieceClass, newPieceColor);
    newPieceName = '';
  }

  function addStructure(preset) {
    networkState.addStructure(preset.name, preset.color);
  }

  function buildHouse() {
    networkState.addHouse({
      name: houseName,
      shape: houseShape,
      width: houseWidth,
      depth: houseDepth,
      floors: houseFloors,
      color: houseColor
    });
  }

  function selectPiece(pieceId) {
    networkState.selectedPieceId = pieceId;
  }

  function updateSelectedPieceDetails() {
    if (!selectedPiece) return;
    networkState.updatePieceDetails(selectedPiece.id, {
      name: inspectorName,
      class: inspectorClass,
      color: inspectorColor
    });
  }

  // Quick link copy handler
  function copyRoomLink() {
    if (!networkState.roomId) return;
    const link = `${window.location.origin}${window.location.pathname}?room=${networkState.roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      showCopied = true;
      setTimeout(() => { showCopied = false; }, 2000);
    });
  }

  // Handle custom piece texture upload
  function handleTextureUpload(event, pieceId) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        networkState.updatePieceTexture(pieceId, e.target.result);
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }
  }

  // Handle custom background image upload
  function handleBackgroundUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        networkState.updateBackgroundImage(e.target.result);
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    }
  }

  // Clear URL connection param
  function resetRoomParam() {
    networkState.disconnect();
  }
</script>

<div class="lobby-container {networkState.role !== 'disconnected' ? 'session-panel' : ''}">
  {#if networkState.role === 'disconnected'}
    <!-- Brand Header -->
    <header class="lobby-header">
      <div class="logo-glow"></div>
      <h1 class="title">AETHELGARD</h1>
      <p class="subtitle">SOUL VTT // NETWORK CONTROLLER</p>
    </header>

    <div class="lobby-grid">
      <div class="glass-card fade-in">
        <h2 class="section-title text-cyan">Host a New Room</h2>
        <p class="section-desc">Start as the Game Master. You will hold the authoritative state of the map, pieces, and build permissions.</p>
        
        <div class="input-group">
          <input 
            type="text" 
            placeholder="Optional Room Code (e.g. gotei13)" 
            bind:value={customHostId}
            class="vtt-input"
          />
          <button 
            onclick={() => networkState.createRoom(customHostId)}
            class="vtt-btn btn-primary"
          >
            Create Room (Master)
          </button>
          <button 
            onclick={() => networkState.startOfflineMode()}
            class="vtt-btn btn-secondary"
            style="width: 100%; margin-top: 0.5rem; border-color: rgba(6, 182, 212, 0.4); color: #22d3ee; background: rgba(6, 182, 212, 0.05);"
          >
            Jogar Solo (Offline / Local)
          </button>
        </div>
      </div>

      <div class="glass-card fade-in">
        <h2 class="section-title text-purple">Join a Session</h2>
        <p class="section-desc">Connect to an active room as a Client player. Characters can be moved, but objects are locked.</p>
        
        <div class="input-group">
          <input 
            type="text" 
            placeholder="Enter Alphanumeric Code" 
            bind:value={targetRoomId}
            class="vtt-input"
          />
          <button 
            onclick={() => networkState.joinRoom(targetRoomId)}
            class="vtt-btn btn-secondary"
          >
            Join Room (Player)
          </button>
        </div>
      </div>
    </div>
  {:else}
      <!-- Active Connection Status Card -->
      <div class="glass-card connection-status fade-in" style="padding: 1rem; margin-bottom: 0.5rem; flex-shrink: 0;">
        <div class="status-indicator-container" style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span class="pulse-dot {networkState.role === 'host' ? 'host-dot' : 'client-dot'}"></span>
          <h2 class="section-title uppercase" style="font-size: 1.1rem; margin: 0;">
            Role: {networkState.role === 'host' ? 'G.M. (Master)' : 'Player (Client)'}
          </h2>
        </div>

        <div class="status-details" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.8rem; margin-bottom: 0.75rem;">
          <div class="detail-row" style="margin: 0; display: flex; justify-content: space-between;">
            <span>Room Code:</span>
            <strong class="room-code-txt">{networkState.roomId}</strong>
          </div>
          {#if networkState.role === 'host'}
            <div class="detail-row" style="margin: 0; display: flex; justify-content: space-between;">
              <span>Friends:</span>
              <strong>{networkState.connections.length}</strong>
            </div>
          {/if}
        </div>

        <div class="button-row" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <button onclick={copyRoomLink} class="vtt-btn btn-share" style="flex: 1; padding: 0.5rem; font-size: 0.75rem;">
            {showCopied ? 'Copied!' : 'Share URL'}
          </button>
          <button onclick={resetRoomParam} class="vtt-btn btn-danger" style="flex: 1; padding: 0.5rem; font-size: 0.75rem;">
            Disconnect
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="lobby-tabs" style="display: flex; gap: 0.35rem; margin-bottom: 0.5rem; flex-shrink: 0; width: 100%;">
        <button class="vtt-btn tab-btn {activeTab === 'map' ? 'active' : ''}" onclick={() => activeTab = 'map'} style="flex: 1; padding: 0.45rem 0.25rem; font-size: 0.72rem; white-space: nowrap;">
          🏰 Mapa
        </button>
        <button class="vtt-btn tab-btn {activeTab === 'tokens' ? 'active' : ''}" onclick={() => activeTab = 'tokens'} style="flex: 1; padding: 0.45rem 0.25rem; font-size: 0.72rem; white-space: nowrap;">
          🎭 Tokens
        </button>
        <button class="vtt-btn tab-btn {activeTab === 'dados' ? 'active' : ''}" onclick={() => activeTab = 'dados'} style="flex: 1; padding: 0.45rem 0.25rem; font-size: 0.72rem; white-space: nowrap;">
          🎲 Ações
        </button>
        <button class="vtt-btn tab-btn {activeTab === 'logs' ? 'active' : ''}" onclick={() => activeTab = 'logs'} style="flex: 1; padding: 0.45rem 0.25rem; font-size: 0.72rem; white-space: nowrap;">
          📜 Logs
        </button>
      </div>

      <!-- Scrollable Tab Content Container -->
      <div class="tab-content-container" style="flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; padding-right: 4px;">
        {#if activeTab === 'map'}
          <!-- MAP CONTROLS TAB -->
          {#if networkState.role === 'host'}
            <div class="glass-card master-controls fade-in" style="padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
              <h3 class="subsection-title" style="margin: 0; padding-bottom: 0.25rem;">Master Settings</h3>
              
              <div class="control-row">
                <span class="control-label">Build Mode:</span>
                <label class="toggle-container">
                  <input 
                    type="checkbox" 
                    checked={networkState.gameState.buildMode} 
                    onchange={() => networkState.toggleBuildMode()} 
                  />
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">
                    <strong>{networkState.gameState.buildMode ? 'ACTIVE' : 'INACTIVE'}</strong>
                  </span>
                </label>
              </div>

              <div class="build-mode-console {networkState.gameState.buildMode ? 'active' : 'inactive'}">
                <div class="build-console-header">
                  <strong>{networkState.gameState.buildMode ? 'CONSTRUCTION ONLINE' : 'CONSTRUCTION LOCKED'}</strong>
                </div>
                <p class="help-text">
                  {#if networkState.gameState.buildMode}
                    Clique em uma estrutura abaixo para criar. NPCs continuam disponíveis.
                  {:else}
                    Ative para construir e mover peças de cenário.
                  {/if}
                </p>
              </div>

              <!-- Save / Load Session -->
              <div class="control-row" style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.75rem; display: flex; gap: 0.5rem; margin-bottom: 0.25rem;">
                <button 
                  onclick={() => networkState.saveSession()} 
                  class="vtt-btn btn-primary"
                  style="flex: 1; padding: 0.45rem; font-size: 0.72rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;"
                >
                  💾 Salvar
                </button>
                <label 
                  class="vtt-btn btn-secondary" 
                  style="flex: 1; padding: 0.45rem; font-size: 0.72rem; text-align: center; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.25rem; margin: 0;"
                >
                  📂 Carregar
                  <input 
                    type="file" 
                    accept=".json" 
                    style="display: none;" 
                    onchange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        networkState.loadSession(event.target.result);
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }} 
                  />
                </label>
              </div>

              <!-- Active tool indication info -->
              {#if networkState.gameState.buildMode}
                <div class="control-row" style="background: rgba(168, 85, 247, 0.1); padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid rgba(168, 85, 247, 0.25); font-size: 0.8rem; display: flex; align-items: center; justify-content: space-between;">
                  <span class="control-label" style="font-size: 0.78rem;">Active Tool:</span>
                  <strong class="uppercase" style="color: #c084fc;">
                    {#if networkState.activeTool === 'hand'}
                      ✋ Camera Hand
                    {:else if networkState.activeTool === 'move'}
                      🎯 Move Tool
                    {:else if networkState.activeTool === 'scale'}
                      📐 Scale Tool
                    {:else if networkState.activeTool === 'draw-wall'}
                      🧱 Wall drawing
                    {:else if networkState.activeTool === 'draw-floor'}
                      🗺️ Floor drawing
                    {/if}
                  </strong>
                </div>
              {/if}

              <div class="structure-palette">
                <h4 class="mini-title">Construction Assets:</h4>
                <div class="structure-grid">
                  {#each structurePresets as preset}
                    <button
                      class="structure-card"
                      disabled={!networkState.gameState.buildMode}
                      onclick={() => addStructure(preset)}
                      title={networkState.gameState.buildMode ? `Place ${preset.name}` : 'Enable Build Mode first'}
                    >
                      <span class="structure-swatch" style="background: {preset.color}"></span>
                      <strong>{preset.name}</strong>
                    </button>
                  {/each}
                </div>
              </div>

              <div class="house-builder" style="border-color: rgba(168, 85, 247, 0.4);">
                <h4 class="mini-title" style="color: #c084fc; margin-top: 0; margin-bottom: 0.5rem;">SketchUp Footprint Drawing:</h4>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; background: rgba(0, 0, 0, 0.25); padding: 0.75rem; border-radius: 8px;">
                  <div class="control-row" style="margin: 0; display: flex; align-items: center; justify-content: space-between;">
                    <span class="control-label" style="font-size: 0.8rem;">Structure Type:</span>
                    <select class="vtt-select" style="padding: 0.35rem 0.55rem; font-size: 0.8rem;"
                      value={networkState.drawingStructureType || 'house'}
                      onchange={(e) => {
                        networkState.drawingStructureType = e.target.value;
                        if (e.target.value === 'wall-line' || e.target.value === 'stair') {
                          networkState.activeTool = 'draw-wall';
                        } else if (e.target.value === 'floor-plane') {
                          networkState.activeTool = 'draw-floor';
                        } else {
                          networkState.activeTool = 'draw-wall';
                        }
                        networkState.drawingMode = true;
                      }}
                    >
                      <option value="wall-line">Wall Line (Parede)</option>
                      <option value="stair">Stairs (Escada)</option>
                      <option value="house">Extruded Block (Bloco 3D)</option>
                      <option value="floor-plane">Floor Platform (Placa Piso)</option>
                    </select>
                  </div>
                  <button 
                    class="vtt-btn {networkState.drawingMode ? 'btn-secondary' : 'btn-primary'}" 
                    style="padding: 0.5rem 1rem; font-size: 0.8rem; width: 100%;"
                    onclick={() => {
                      networkState.drawingMode = !networkState.drawingMode;
                      networkState.drawingStartHex = null;
                      if (networkState.drawingMode) {
                        networkState.addLog("Drawing mode active. Click start hex, move cursor, then click end hex.");
                      }
                    }}
                  >
                    {networkState.drawingMode ? '✕ Cancel Drawing' : '✏️ Draw Footprint'}
                  </button>
                  <p class="help-text" style="font-size: 0.75rem; margin: 0; color: #94a3b8; line-height: 1.3;">
                    {#if networkState.drawingMode}
                      {#if networkState.drawingStartHex === null}
                        <strong>Step 1</strong>: Click a grid cell to set the first corner.
                      {:else}
                        <strong>Step 2</strong>: Hover and click another cell to set the second corner.
                      {/if}
                    {:else}
                      Activate and draw a rectangle footprint on the grid, then extrude in the Inspector.
                    {/if}
                  </p>
                </div>
              </div>

              <!-- Grid Size Selector -->
              <div class="control-row">
                <span class="control-label">Grid Size:</span>
                <select 
                  value={networkState.gameState.gridSize || 24} 
                  onchange={(e) => networkState.updateGridSize(Number(e.target.value))} 
                  class="vtt-select"
                >
                  <option value={12}>12 x 12 (Compact)</option>
                  <option value={16}>16 x 16 (Skirmish)</option>
                  <option value={24}>24 x 24 (Balanced)</option>
                  <option value={32}>32 x 32 (Large)</option>
                  <option value={48}>48 x 48 (Gotei Scale)</option>
                  <option value={64}>64 x 64 (Raid Scale)</option>
                </select>
              </div>

              <!-- Basic Plane Size Selector -->
              <div class="control-row">
                <span class="control-label">Plano Básico:</span>
                <select 
                  value={networkState.gameState.basicPlaneSize || 'medium'} 
                  onchange={(e) => networkState.updateBasicPlaneSize(e.target.value)} 
                  class="vtt-select"
                >
                  <option value="small">Pequeno (Small)</option>
                  <option value="medium">Médio (Medium)</option>
                  <option value="large">Grande (Large)</option>
                </select>
              </div>

              <!-- Background Map Upload Selector -->
              <div class="control-row">
                <span class="control-label">Background Map:</span>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <label class="file-upload-btn" style="margin: 0; padding: 0.5rem 1rem; font-size: 0.8rem;">
                    Upload Map
                    <input 
                      type="file" 
                      accept="image/*" 
                      onchange={handleBackgroundUpload} 
                      style="display: none;"
                    />
                  </label>
                  {#if networkState.gameState.backgroundImage}
                    <button 
                      onclick={() => networkState.updateBackgroundImage('')} 
                      class="delete-piece-btn" 
                      style="margin: 0; padding: 0.5rem; line-height: 1;"
                      title="Remove Background Image"
                    >
                      ✕
                    </button>
                  {/if}
                </div>
              </div>

              <!-- Ambient Theme Selector -->
              <div class="control-row">
                <span class="control-label">Ambience:</span>
                <div class="theme-buttons">
                  <button 
                    onclick={() => networkState.updateTheme('soul-society')} 
                    class="theme-btn {networkState.gameState.theme === 'soul-society' ? 'active soul-society' : ''}"
                  >
                    Gotei
                  </button>
                  <button 
                    onclick={() => networkState.updateTheme('hueco-mundo')} 
                    class="theme-btn {networkState.gameState.theme === 'hueco-mundo' ? 'active hueco-mundo' : ''}"
                  >
                    Hueco
                  </button>
                  <button 
                    onclick={() => networkState.updateTheme('karakura-town')} 
                    class="theme-btn {networkState.gameState.theme === 'karakura-town' ? 'active karakura-town' : ''}"
                  >
                    Karakura
                  </button>
                </div>
              </div>
            </div>
          {:else}
            <!-- Client view of map details -->
            <div class="glass-card client-info fade-in" style="padding: 1rem;">
              <h3 class="subsection-title" style="margin-top: 0; padding-bottom: 0.25rem;">Map Info</h3>
              <div class="status-details" style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
                <div class="detail-row" style="display: flex; justify-content: space-between;">
                  <span>Grid Size:</span>
                  <strong>{networkState.gameState.gridSize || 24} x {networkState.gameState.gridSize || 24}</strong>
                </div>
                <div class="detail-row" style="display: flex; justify-content: space-between;">
                  <span>Reiatsu Ambience:</span>
                  <strong class="uppercase">{networkState.gameState.theme || 'soul-society'}</strong>
                </div>
                <div class="detail-row" style="display: flex; justify-content: space-between;">
                  <span>Build Mode:</span>
                  <strong class={networkState.gameState.buildMode ? 'text-cyan' : 'text-purple'}>
                    {networkState.gameState.buildMode ? 'ACTIVE (Customizing)' : 'LOCKED'}
                  </strong>
                </div>
              </div>
            </div>
          {/if}
        {:else if activeTab === 'tokens'}
          <!-- TOKENS TAB -->
          {#if networkState.role === 'host'}
            <!-- Piece Creator -->
            <div class="glass-card piece-creator-section fade-in" style="padding: 1rem;">
              <h4 class="mini-title" style="margin: 0;">Create Custom Token:</h4>
              <div class="creator-form">
                <input 
                  type="text" 
                  placeholder="Token Name (e.g. Ichigo)" 
                  bind:value={newPieceName}
                  class="vtt-input mini-input"
                />
                <div class="form-row" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                  <select bind:value={newPieceClass} class="vtt-select mini-select" style="flex: 1;">
                    <option value="personagem">Character</option>
                    <option value="objeto">Object</option>
                  </select>
                  <input 
                    type="color" 
                    bind:value={newPieceColor} 
                    class="vtt-color-picker"
                  />
                  <button onclick={submitNewPiece} class="vtt-btn btn-add-piece" style="padding: 0 1rem;">
                    Create
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- Selected piece → CharacterSheet opens automatically -->
          {#if selectedPiece}
            <div class="glass-card fade-in" style="padding: 0.85rem 1rem; border-color: rgba({selectedPiece.color ? selectedPiece.color : '168, 85, 247'}, 0.3);">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                {#if selectedPiece.textureUrl}
                  <img src={selectedPiece.textureUrl} alt={selectedPiece.name} style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; border: 2px solid {selectedPiece.color};" />
                {:else}
                  <div style="width: 40px; height: 40px; border-radius: 8px; background: {selectedPiece.color}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1rem; color: #fff;">
                    {selectedPiece.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                {/if}
                <div style="flex: 1; min-width: 0;">
                  <strong style="display: block; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{selectedPiece.name}</strong>
                  <span style="font-size: 0.7rem; color: #64748b; text-transform: uppercase; font-family: monospace;">{selectedPiece.structureType ?? selectedPiece.class}</span>
                </div>
                <button class="clear-selection-btn" onclick={() => { networkState.selectedPieceId = null; }}>✕</button>
              </div>
              {#if selectedPiece.class === 'personagem' && selectedPiece.maxHp}
                <div style="margin-top: 0.6rem;">
                  <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: {Math.max(0, Math.min(100, ((selectedPiece.hp ?? 0) / selectedPiece.maxHp) * 100))}%; background: {(selectedPiece.hp / selectedPiece.maxHp) > 0.6 ? '#22c55e' : (selectedPiece.hp / selectedPiece.maxHp) > 0.3 ? '#f59e0b' : '#ef4444'}; transition: width 0.3s;"></div>
                  </div>
                  <span style="font-size: 0.68rem; color: #64748b; font-family: monospace;">HP: {selectedPiece.hp ?? 0} / {selectedPiece.maxHp}</span>
                </div>
              {/if}
              <p style="margin: 0.5rem 0 0; font-size: 0.72rem; color: #a855f7; font-style: italic;">→ Ficha aberta no painel direito</p>
            </div>
          {/if}

          <!-- Tokens List -->
          <div class="glass-card texture-upload-section fade-in" style="padding: 1rem;">
            <h4 class="mini-title" style="margin: 0 0 0.5rem;">Lista de Tokens:</h4>
            <div class="pieces-uploader" style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 300px; overflow-y: auto;">
              {#each Object.values(networkState.gameState.pieces) as piece (piece.id)}
                <div
                  class="piece-uploader-row {networkState.selectedPieceId === piece.id ? 'selected-row' : ''}"
                  style="padding: 0.4rem 0.6rem; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); border-radius: 6px; cursor: pointer; border: 1px solid {networkState.selectedPieceId === piece.id ? piece.color : 'transparent'};"
                  onclick={() => selectPiece(piece.id)}
                  role="button"
                  tabindex="0"
                >
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: {piece.color}; flex-shrink: 0;"></div>
                    <span class="piece-name" style="font-size: 0.82rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                      {piece.name}
                    </span>
                    {#if piece.class === 'personagem' && piece.maxHp}
                      <span style="font-size: 0.65rem; font-family: monospace; color: #64748b; flex-shrink: 0;">{piece.hp ?? 0}/{piece.maxHp}</span>
                    {/if}
                  </div>
                  <div class="piece-actions" style="display: flex; gap: 0.25rem; flex-shrink: 0; margin-left: 0.4rem;">
                    {#if networkState.role === 'host'}
                      <button 
                        onclick={(e) => { e.stopPropagation(); networkState.deletePiece(piece.id); }} 
                        class="delete-piece-btn"
                        title="Excluir Token"
                        style="padding: 0.15rem 0.35rem; font-size: 0.65rem;"
                      >
                        ✕
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

        {:else if activeTab === 'dados'}
          <!-- DADOS & MEDIA TAB -->
          <div class="glass-card fade-in" style="padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem;">
            <h3 class="subsection-title" style="margin: 0; padding-bottom: 0.25rem; color: #a855f7;">🎲 Rolador de Dados</h3>
            <div class="dice-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
              {#each ['D4', 'D6', 'D8', 'D10', 'D12', 'D20', 'D100'] as die}
                <button
                  onclick={() => networkState.rollDice(die)}
                  class="vtt-btn btn-primary"
                  style="padding: 0.5rem; font-size: 0.8rem; font-weight: bold;"
                >
                  {die}
                </button>
              {/each}
            </div>

            <!-- GM Image Sharing Section -->
            {#if networkState.role === 'host'}
              <div class="gm-media-share" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.85rem; margin-top: 0.25rem;">
                <h3 class="subsection-title" style="margin: 0 0 0.5rem; color: #06b6d4;">📺 Compartilhar Imagem</h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <input
                    type="text"
                    placeholder="URL da Imagem (HTTP/HTTPS ou base64)"
                    id="share-img-url"
                    class="vtt-input mini-input"
                    style="font-size: 0.75rem;"
                  />
                  <div style="display: flex; gap: 0.4rem;">
                    <button
                      onclick={() => {
                        const input = document.getElementById('share-img-url');
                        if (input && input.value.trim()) {
                          networkState.sharePopupImage(input.value.trim());
                        }
                      }}
                      class="vtt-btn btn-secondary"
                      style="flex: 1; padding: 0.45rem; font-size: 0.72rem;"
                    >
                      Exibir Tela Cheia
                    </button>
                    <!-- File upload for local images -->
                    <label
                      class="vtt-btn btn-secondary"
                      style="padding: 0.45rem; font-size: 0.72rem; text-align: center; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 0;"
                    >
                      Upar Img
                      <input
                        type="file"
                        accept="image/*"
                        style="display: none;"
                        onchange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            networkState.sharePopupImage(event.target.result);
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {#if networkState.gameState.activePopupImage}
                    <button
                      onclick={() => networkState.clearPopupImage()}
                      class="vtt-btn btn-danger"
                      style="padding: 0.45rem; font-size: 0.72rem; width: 100%; margin-top: 0.25rem;"
                    >
                      Fechar Exibição para Todos
                    </button>
                  {/if}
                </div>
              </div>
            {/if}

            <!-- Recent rolls display -->
            <div class="recent-rolls-section" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.85rem;">
              <h4 class="mini-title" style="margin: 0 0 0.5rem; color: #cbd5e1;">Histórico de Rolagens:</h4>
              <div style="display: flex; flex-direction: column; gap: 0.35rem; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.78rem;">
                {#if (networkState.gameState.recentRolls?.length || 0) === 0}
                  <div style="color: #64748b; font-style: italic;">Nenhum dado rolado ainda...</div>
                {:else}
                  {#each (networkState.gameState.recentRolls || []) as roll (roll.id)}
                    <div style="padding: 0.3rem 0.5rem; background: rgba(0,0,0,0.25); border-radius: 6px; display: flex; justify-content: space-between; border-left: 3px solid #a855f7;">
                      <span>{roll.name}: <strong>{roll.die}</strong></span>
                      <strong style="color: #22d3ee; font-size: 0.85rem;">[ {roll.result} ]</strong>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>

        {:else if activeTab === 'logs'}
          <!-- ACTIVITY LOG TAB -->
          <div class="glass-card logs-card fade-in" style="padding: 1rem; display: flex; flex-direction: column; flex: 1; min-height: 350px;">
            <div class="logs-header" style="margin-bottom: 0.5rem;">
              <h2 class="section-title" style="font-size: 1.1rem; margin: 0;">Network Activity Log</h2>
            </div>
            <div class="logs-window" style="flex: 1; min-height: 0; overflow-y: auto; font-family: monospace; font-size: 0.8rem; background: rgba(0, 0, 0, 0.4); padding: 0.5rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; flex-direction: column; gap: 0.25rem;">
              {#if networkState.logs.length === 0}
                <div class="no-logs">System idle...</div>
              {:else}
                {#each networkState.logs as log}
                  <div class="log-entry {log.includes('BLOCKED') ? 'log-blocked' : log.includes('Client') ? 'log-client' : log.includes('Host') ? 'log-host' : ''}" style="margin: 0; padding: 0.15rem 0;">
                    {log}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}

  {#if networkState.error}
    <div class="alert-banner fade-in" style="flex-direction: column; gap: 0.65rem; align-items: flex-start; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <span class="alert-icon">⚠️</span>
        <span class="alert-text">{networkState.error}</span>
      </div>
      <button 
        onclick={() => networkState.startOfflineMode()} 
        class="vtt-btn"
        style="padding: 0.35rem 0.85rem; font-size: 0.75rem; background: #ef4444; border: 1px solid #ef4444; color: #fff; cursor: pointer; border-radius: 6px; font-weight: bold;"
      >
        Jogar em Modo Offline (Solo)
      </button>
    </div>
  {/if}
</div>

<style>
  /* Premium Dark Sci-Fi Aesthetic styling */
  .lobby-container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    font-family: 'Outfit', 'Inter', system-ui, sans-serif;
    color: #e2e8f0;
  }

  .session-panel {
    padding: 0;
    max-width: none;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-btn {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab-btn:hover {
    background: rgba(168, 85, 247, 0.1);
    color: #fff;
  }

  .tab-btn.active {
    background: rgba(168, 85, 247, 0.25);
    border-color: #a855f7;
    color: #fff;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
  }

  .session-panel .lobby-header {
    display: none;
  }

  .session-panel .lobby-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .session-panel .glass-card {
    padding: 1rem;
  }

  .lobby-header {
    text-align: center;
    margin-bottom: 3rem;
    position: relative;
  }

  .logo-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 250px;
    height: 60px;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(6, 182, 212, 0.05) 70%, transparent 100%);
    filter: blur(20px);
    z-index: -1;
  }

  .title {
    font-size: 3rem;
    font-weight: 900;
    letter-spacing: 0.5rem;
    background: linear-gradient(135deg, #a855f7 0%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
    text-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
  }

  .subtitle {
    font-size: 0.85rem;
    letter-spacing: 0.25rem;
    color: #94a3b8;
    margin-top: 0.5rem;
  }

  .lobby-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  /* Glassmorphism Card Design */
  .glass-card {
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
  }

  .glass-card:hover {
    border-color: rgba(168, 85, 247, 0.2);
    box-shadow: 0 12px 40px rgba(168, 85, 247, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 0.5rem;
    letter-spacing: 0.05rem;
  }

  .subsection-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    color: #a855f7;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.5rem;
  }

  .mini-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #94a3b8;
    margin-bottom: 0.75rem;
  }

  .text-cyan {
    color: #06b6d4;
  }

  .text-purple {
    color: #a855f7;
  }

  .section-desc {
    color: #94a3b8;
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }

  /* Inputs and Buttons styling */
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .vtt-input {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 0.85rem 1rem;
    color: #fff;
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .vtt-input:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.3);
  }

  .vtt-btn {
    padding: 0.85rem 1.5rem;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.05rem;
  }

  .btn-primary {
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
    color: #0f172a;
    box-shadow: 0 4px 15px rgba(6, 182, 212, 0.4);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(6, 182, 212, 0.6);
  }

  .btn-secondary {
    background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
    color: #fff;
    box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
  }

  .btn-secondary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(168, 85, 247, 0.6);
  }

  .btn-share {
    background: rgba(6, 182, 212, 0.1);
    color: #06b6d4;
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .btn-share:hover {
    background: rgba(6, 182, 212, 0.25);
    color: #fff;
  }

  .btn-danger {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .btn-danger:hover {
    background: #ef4444;
    color: #fff;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
  }

  /* Active Connection info */
  .status-indicator-container {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .pulse-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }

  .host-dot {
    background: #06b6d4;
    box-shadow: 0 0 10px #06b6d4;
    animation: pulse 1.8s infinite;
  }

  .client-dot {
    background: #a855f7;
    box-shadow: 0 0 10px #a855f7;
    animation: pulse 1.8s infinite;
  }

  @keyframes pulse {
    0% { transform: scale(0.9); opacity: 0.6; }
    50% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(0.9); opacity: 0.6; }
  }

  .status-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: rgba(0, 0, 0, 0.25);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 1.5rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
  }

  .detail-row span {
    color: #94a3b8;
  }

  .room-code-txt {
    font-family: monospace;
    font-size: 1.15rem;
    color: #06b6d4;
    text-shadow: 0 0 5px rgba(6, 182, 212, 0.4);
  }

  .peer-id-txt {
    font-family: monospace;
    color: #a855f7;
  }

  .button-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  /* Toggle Slider style */
  .toggle-container {
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    margin-bottom: 1.5rem;
    gap: 0.75rem;
  }

  .toggle-container input {
    display: none;
  }

  .toggle-slider {
    width: 46px;
    height: 24px;
    background-color: #334155;
    border-radius: 12px;
    position: relative;
    transition: background-color 0.2s;
  }

  .toggle-slider::before {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .toggle-container input:checked + .toggle-slider {
    background-color: #a855f7;
  }

  .toggle-container input:checked + .toggle-slider::before {
    transform: translateX(22px);
  }

  .toggle-label {
    font-size: 0.95rem;
  }

  .toggle-label strong {
    color: #a855f7;
  }

  .build-mode-console {
    padding: 1rem;
    border-radius: 10px;
    margin-bottom: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .build-mode-console.active {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(6, 182, 212, 0.12));
    border-color: rgba(168, 85, 247, 0.45);
    box-shadow: inset 0 0 24px rgba(168, 85, 247, 0.12);
  }

  .build-mode-console.inactive {
    background: rgba(15, 23, 42, 0.55);
    border-color: rgba(100, 116, 139, 0.25);
  }

  .build-console-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.82rem;
    letter-spacing: 0.05rem;
  }

  .build-console-header strong {
    color: #e2e8f0;
  }

  .build-console-header span {
    color: #22d3ee;
    font-size: 0.72rem;
    text-transform: uppercase;
  }

  .structure-palette {
    background: rgba(0, 0, 0, 0.18);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 1.25rem;
  }

  .structure-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.6rem;
  }

  .structure-card {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.5rem;
    align-items: center;
    text-align: left;
    background: rgba(15, 23, 42, 0.76);
    color: #e2e8f0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.65rem;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s, opacity 0.2s;
  }

  .structure-card:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: rgba(6, 182, 212, 0.45);
  }

  .structure-card:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .structure-card strong {
    font-size: 0.78rem;
  }

  .structure-card small {
    grid-column: 2;
    color: #94a3b8;
    font-size: 0.68rem;
  }

  .structure-swatch {
    grid-row: span 2;
    width: 14px;
    height: 32px;
    border-radius: 999px;
    box-shadow: 0 0 10px currentColor;
  }

  .house-builder {
    background: rgba(15, 23, 42, 0.72);
    padding: 1rem;
    border-radius: 10px;
    border: 1px solid rgba(34, 211, 238, 0.16);
    margin-bottom: 1.25rem;
  }

  .house-builder-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
    margin-bottom: 0.85rem;
  }

  .builder-field {
    display: grid;
    gap: 0.3rem;
    color: #94a3b8;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04rem;
  }

  .builder-field.wide {
    grid-column: 1 / -1;
  }

  .btn-build-house {
    width: 100%;
    background: linear-gradient(135deg, #22d3ee 0%, #a855f7 100%);
    color: #020617;
    margin-bottom: 0.65rem;
  }

  .btn-build-house:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  /* Theme selection & styling */
  .control-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    gap: 1rem;
  }

  .control-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: #94a3b8;
  }

  .vtt-select {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 0.5rem 1rem;
    color: #fff;
    font-size: 0.85rem;
    outline: none;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .vtt-select:focus {
    border-color: #06b6d4;
  }

  .theme-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .theme-btn {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .theme-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .theme-btn.active {
    color: #fff;
    font-weight: bold;
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
  }

  .theme-btn.active.soul-society {
    border-color: #a855f7;
    background: rgba(168, 85, 247, 0.2);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
  }

  .theme-btn.active.hueco-mundo {
    border-color: #06b6d4;
    background: rgba(6, 182, 212, 0.2);
    box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
  }

  .theme-btn.active.karakura-town {
    border-color: #f97316;
    background: rgba(249, 115, 22, 0.2);
    box-shadow: 0 0 10px rgba(249, 115, 22, 0.2);
  }

  /* Piece Creator elements */
  .piece-creator-section {
    background: rgba(0, 0, 0, 0.15);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 1.25rem;
  }

  .creator-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .mini-input {
    padding: 0.4rem 0.75rem !important;
    font-size: 0.85rem !important;
  }

  .mini-select {
    padding: 0.4rem 0.75rem !important;
    font-size: 0.825rem !important;
    flex-grow: 1;
    background-color: rgba(15, 23, 42, 0.95);
  }

  .vtt-color-picker {
    width: 38px;
    height: 32px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    background: none;
    cursor: pointer;
    padding: 0;
  }

  .btn-add-piece {
    padding: 0.4rem 1.25rem !important;
    font-size: 0.8rem !important;
    background: linear-gradient(135deg, #a855f7 0%, #06b6d4 100%);
    color: #fff;
    box-shadow: 0 4px 10px rgba(168, 85, 247, 0.2);
  }

  .btn-add-piece:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 12px rgba(168, 85, 247, 0.3);
  }

  .asset-inspector {
    background: rgba(2, 6, 23, 0.62);
    padding: 1rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-bottom: 1.25rem;
  }

  .asset-inspector.has-selection {
    border-color: rgba(6, 182, 212, 0.28);
    box-shadow: inset 0 0 20px rgba(6, 182, 212, 0.07);
  }

  .inspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .clear-selection-btn,
  .inspect-piece-btn {
    background: rgba(6, 182, 212, 0.1);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.28);
    border-radius: 5px;
    padding: 0.28rem 0.5rem;
    font-size: 0.68rem;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.04rem;
  }

  .clear-selection-btn:hover,
  .inspect-piece-btn:hover {
    background: rgba(6, 182, 212, 0.22);
  }

  .selected-preview {
    display: grid;
    grid-template-columns: 62px 1fr;
    gap: 0.85rem;
    align-items: center;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid;
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .selected-preview img,
  .fallback-preview {
    width: 56px;
    height: 56px;
    border-radius: 10px;
    object-fit: cover;
  }

  .fallback-preview {
    display: grid;
    place-items: center;
    color: #fff;
    font-weight: 900;
    font-family: 'Fira Code', monospace;
  }

  .selected-preview strong,
  .selected-preview span {
    display: block;
  }

  .selected-preview span {
    color: #94a3b8;
    font-size: 0.78rem;
    margin-top: 0.2rem;
  }

  .inspector-form {
    display: grid;
    gap: 0.8rem;
  }

  .inspector-form label {
    display: grid;
    gap: 0.35rem;
    color: #94a3b8;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04rem;
  }

  .wide-color {
    width: 100%;
    height: 36px;
  }

  .asset-upload-drop {
    border: 1px dashed rgba(168, 85, 247, 0.45);
    border-radius: 10px;
    padding: 0.85rem;
    background: rgba(168, 85, 247, 0.08);
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .asset-upload-drop:hover {
    background: rgba(168, 85, 247, 0.16);
    border-color: rgba(6, 182, 212, 0.55);
  }

  .asset-upload-drop span,
  .asset-upload-drop small {
    display: block;
  }

  .asset-upload-drop span {
    color: #e9d5ff;
    font-size: 0.82rem;
  }

  .asset-upload-drop small {
    color: #94a3b8;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  .asset-upload-drop input {
    display: none;
  }

  .empty-inspector {
    color: #64748b;
    font-size: 0.82rem;
    line-height: 1.4;
    margin: 0.2rem 0 0;
  }

  .floor-console {
    display: grid;
    gap: 0.45rem;
    padding: 0.85rem;
    border-radius: 10px;
    background: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.24);
  }

  .floor-console strong,
  .floor-console span,
  .floor-console small {
    display: block;
  }

  .floor-console strong {
    color: #e0f2fe;
    font-size: 0.82rem;
  }

  .floor-console span {
    color: #22d3ee;
    font-size: 0.78rem;
  }

  .floor-console small {
    color: #94a3b8;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }

  .floor-console input[type="range"] {
    width: 100%;
    accent-color: #22d3ee;
  }

  .access-console {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.28);
  }

  /* Texture Upload and token management elements */
  .texture-upload-section {
    background: rgba(0, 0, 0, 0.15);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .pieces-uploader {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .piece-uploader-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.02);
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    border: 1px solid transparent;
  }

  .piece-uploader-row.selected-row {
    border-color: rgba(6, 182, 212, 0.45);
    background: rgba(6, 182, 212, 0.08);
  }

  .piece-name {
    font-size: 0.85rem;
    padding-left: 0.5rem;
  }

  .piece-class-lbl {
    color: #64748b;
    font-weight: normal;
  }

  .piece-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .file-upload-btn {
    font-size: 0.75rem;
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    padding: 0.3rem 0.65rem;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid rgba(168, 85, 247, 0.3);
    transition: all 0.2s;
  }

  .file-upload-btn:hover {
    background: #a855f7;
    color: #fff;
  }

  .delete-piece-btn {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    width: 24px;
    height: 24px;
    font-size: 0.7rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .delete-piece-btn:hover {
    background: #ef4444;
    color: #fff;
    border-color: #ef4444;
  }

  /* Client info styles */
  .client-info {
    background: rgba(0, 0, 0, 0.25);
    padding: 1.25rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .build-mode-pill {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .build-mode-pill.active {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .build-mode-pill.inactive {
    background: rgba(71, 85, 105, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(71, 85, 105, 0.3);
  }

  .help-text {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.4;
  }

  /* Logs styles */
  .logs-card {
    display: flex;
    flex-direction: column;
    max-height: 480px;
  }

  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
  }

  .log-indicator {
    font-size: 0.7rem;
    background: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    border: 1px solid rgba(6, 182, 212, 0.3);
    text-transform: uppercase;
    font-weight: bold;
    letter-spacing: 0.05rem;
  }

  .logs-window {
    flex-grow: 1;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    font-family: 'Fira Code', monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
  }

  .no-logs {
    color: #475569;
    text-align: center;
    padding: 2rem 0;
  }

  .log-entry {
    color: #94a3b8;
    word-break: break-all;
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
    padding-bottom: 0.25rem;
  }

  .log-blocked {
    color: #f87171 !important;
    text-shadow: 0 0 5px rgba(248, 113, 113, 0.3);
  }

  .log-client {
    color: #c084fc !important;
  }

  .log-host {
    color: #22d3ee !important;
  }

  /* Alert banners */
  .alert-banner {
    margin-top: 2rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    padding: 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
  }

  /* Animations */
  .fade-in {
    animation: fadeIn 0.4s ease-out forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .uppercase {
    text-transform: uppercase;
  }
</style>
