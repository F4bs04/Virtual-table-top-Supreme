<script>
  import { networkState } from '../networkState.svelte.js';

  let showTexturePopup = $state(false);
  let showBleachPopup = $state(false);

  const standardTextures = [
    { name: 'Black Brick', path: '/Model/textures/Black_brick.png' },
    { name: 'Brick Texture', path: '/Model/textures/Bricktexture.png' },
    { name: 'Gray Brick', path: '/Model/textures/Bricktexture_gray.png' }
  ];

  const bleachCollection = [
    { name: 'Arrancar 1 Jaliel', path: '/Model/bleach Collection/Arrancar 1 Jaliel.png' },
    { name: 'Jaliel Ressurection', path: '/Model/bleach Collection/Jaliel Ressurection.png' },
    { name: 'Jaliel True Ressurection', path: '/Model/bleach Collection/Jaliel True Ressurection.png' },
    { name: 'Melisante Arrancar 2', path: '/Model/bleach Collection/Melisante Arrancar 2.png' },
    { name: 'Melisante Ressurection', path: '/Model/bleach Collection/Melisante Ressurection.png' },
    { name: 'Melisante Shikai', path: '/Model/bleach Collection/Melisante Shikai.png' },
    { name: 'Melisante True Ressurection', path: '/Model/bleach Collection/Melisante True Ressurection.png' },
    { name: 'Shinigami Knox Bankai', path: '/Model/bleach Collection/Shinigami Knox bankai.png' },
    { name: 'Shinigami Knox', path: '/Model/bleach Collection/Shinigami Knox.png' },
    { name: 'Shinigami Nelson', path: '/Model/bleach Collection/Shinigami Nelson.png' },
    { name: 'Shinigami Raiden', path: '/Model/bleach Collection/Shinigami Raiden.png' },
    { name: 'Shinigami Serjão Bankai', path: '/Model/bleach Collection/Shinimgami Serjão bankai.png' },
    { name: 'Shinigami Serjão', path: '/Model/bleach Collection/Shinimgami Serjão.png' },
    { name: 'Hollow Ksante', path: '/Model/bleach Collection/hollow Ksante.png' },
    { name: 'Hollow Azul', path: '/Model/bleach Collection/hollow azul.png' },
    { name: 'Monstro Hollow', path: '/Model/bleach Collection/monstro hollow.png' },
    { name: 'Urahara', path: '/Model/bleach Collection/urahra.png' }
  ];

  // ── Derived state ──────────────────────────────────────────────────────────
  const piece = $derived(
    networkState.selectedPieceId
      ? (networkState.getPiece(networkState.selectedPieceId) ?? null)
      : null
  );

  const canEdit = $derived(networkState.role === 'host');
  const canEditSheet = $derived(
    networkState.role === 'host' ||
    (networkState.role === 'client' && piece?.class === 'personagem')
  );

  const isStructure = $derived(!!piece?.structureType);
  const hpPercent = $derived(
    piece?.maxHp ? Math.max(0, Math.min(100, (piece.hp / piece.maxHp) * 100)) : 0
  );

  // HP bar color: green → yellow → red
  const hpColor = $derived.by(() => {
    if (hpPercent > 60) return '#22c55e';
    if (hpPercent > 30) return '#f59e0b';
    return '#ef4444';
  });

  const epPercent = $derived(
    piece?.maxEp ? Math.max(0, Math.min(100, ((piece.ep ?? 0) / piece.maxEp) * 100)) : 0
  );

  function adjustEp(delta) {
    if (!piece || !canEditSheet) return;
    const newEp = Math.max(0, Math.min(piece.maxEp ?? 9999, (piece.ep ?? 0) + delta));
    networkState.updatePieceSheet(piece.id, { ep: newEp });
  }

  function setEp(val) {
    if (!piece || !canEditSheet) return;
    const newEp = Math.max(0, Math.min(piece.maxEp ?? 9999, Number(val) || 0));
    networkState.updatePieceSheet(piece.id, { ep: newEp });
  }

  function setMaxEp(val) {
    if (!piece || !canEdit) return;
    const newMax = Math.max(1, Number(val) || 1);
    networkState.updatePieceSheet(piece.id, { maxEp: newMax, ep: Math.min(piece.ep ?? newMax, newMax) });
  }

  // Local notes state (editable, flushed on blur)
  let localNotes = $state('');
  $effect(() => {
    if (piece) localNotes = piece.notes ?? '';
  });

  // ── Actions ────────────────────────────────────────────────────────────────
  function close() {
    networkState.selectedPieceId = null;
  }

  function adjustHp(delta) {
    if (!piece || !canEditSheet) return;
    const newHp = Math.max(0, Math.min(piece.maxHp ?? 9999, (piece.hp ?? 0) + delta));
    networkState.updatePieceSheet(piece.id, { hp: newHp });
  }

  function applyQuickHp(inputStr) {
    if (!piece || !canEditSheet) return;
    const cleanStr = inputStr.trim();
    if (!cleanStr) return;
    const isPlus = cleanStr.startsWith('+');
    const numValue = Math.abs(parseInt(cleanStr.replace(/^[+-]/, '')));
    if (isNaN(numValue)) return;
    const delta = isPlus ? numValue : -numValue;
    adjustHp(delta);
  }

  function setHp(val) {
    if (!piece || !canEditSheet) return;
    const newHp = Math.max(0, Math.min(piece.maxHp ?? 9999, Number(val) || 0));
    networkState.updatePieceSheet(piece.id, { hp: newHp });
  }

  function setMaxHp(val) {
    if (!piece || !canEdit) return;
    const newMax = Math.max(1, Number(val) || 1);
    networkState.updatePieceSheet(piece.id, { maxHp: newMax, hp: Math.min(piece.hp ?? newMax, newMax) });
  }

  function saveNotes() {
    if (!piece || !canEditSheet) return;
    networkState.updatePieceSheet(piece.id, { notes: localNotes });
  }

  async function uploadTextureFromInput(e) {
    if (!piece || !canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await networkState.tokenImageFileToDataUrl(file);
      if (dataUrl) networkState.updatePieceTexture(piece.id, dataUrl);
    } catch (err) {
      console.error('Erro ao carregar imagem do token:', err);
      networkState.addLog('Erro ao carregar imagem do token. Tente uma imagem menor ou outro formato.');
    } finally {
      e.target.value = '';
    }
  }

  async function handlePhotoUpload(e) {
    if (!piece || !canEdit) return;
    const files = Array.from(e.target.files);
    try {
      const uploadedPhotos = [];
      for (const file of files) {
        const dataUrl = await networkState.tokenImageFileToDataUrl(file);
        if (dataUrl) uploadedPhotos.push(dataUrl);
      }
      if (uploadedPhotos.length > 0) {
        networkState.updatePieceSheet(piece.id, { photos: [...(piece.photos ?? []), ...uploadedPhotos] });
      }
    } catch (err) {
      console.error('Erro ao carregar fotos:', err);
      networkState.addLog('Erro ao carregar fotos. Tente imagens menores ou outro formato.');
    } finally {
      e.target.value = '';
    }
  }

  function setMainPhoto(photoUrl) {
    if (!piece || !canEdit) return;
    networkState.updatePieceDetails(piece.id, { textureUrl: photoUrl });
  }

  function removePhoto(index) {
    if (!piece || !canEdit) return;
    const photos = [...(piece.photos ?? [])];
    photos.splice(index, 1);
    networkState.updatePieceSheet(piece.id, { photos });
  }

  // ── Structure property helpers ─────────────────────────────────────────────
  function updateStructureProp(key, val) {
    if (!piece || !canEdit) return;
    networkState.updatePieceDetails(piece.id, { [key]: Number(val) });
  }
</script>

<!-- Slide-in overlay panel -->
{#if piece}
  <!-- Sheet Panel -->
  <aside
    class="character-sheet"
    role="complementary"
    aria-label="Character Sheet"
    onpointerdown={(e) => e.stopPropagation()}
    onpointerup={(e) => e.stopPropagation()}
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Close button -->
    <button class="sheet-close" onclick={close} title="Fechar ficha (ESC)">✕</button>

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <div class="sheet-header" style="--accent: {piece.color}">
      <div class="header-accent-bar"></div>
      <div class="header-content">
        <div class="piece-avatar">
          {#if piece.textureUrl}
            <img src={piece.textureUrl} alt={piece.name} class="avatar-img" />
          {:else}
            <div class="avatar-initials" style="background: {piece.color}">
              {piece.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          {/if}
          <div class="avatar-badge {piece.class === 'personagem' ? 'badge-char' : 'badge-obj'}">
            {piece.class === 'personagem' ? 'PERSONAGEM' : isStructure ? 'ESTRUTURA' : 'OBJETO'}
          </div>
        </div>
        <div class="header-info">
          <h2 class="piece-name">{piece.name}</h2>
          <span class="piece-type">{piece.structureType ?? piece.class}</span>
        </div>
      </div>
    </div>

    <!-- ── Scrollable body ────────────────────────────────────────── -->
    <div class="sheet-body">

      <!-- ── Photo Gallery ──────────────────────────────────────── -->
      <section class="sheet-section">
        <div class="section-title-row">
          <h3 class="section-label">📸 Fotos</h3>
          {#if canEdit}
            <label class="add-photo-btn" title="Adicionar fotos">
              + Adicionar
              <input type="file" accept="image/*" multiple onchange={handlePhotoUpload} />
            </label>
          {/if}
        </div>
        <div class="photo-gallery">
          <!-- Main texture as first photo -->
          {#if piece.textureUrl}
            <div class="photo-thumb active-thumb" title="Foto principal">
              <img src={piece.textureUrl} alt="principal" />
              <div class="thumb-label">Principal</div>
            </div>
          {/if}
          <!-- Additional photos -->
          {#each (piece.photos ?? []) as photo, i}
            <div class="photo-thumb">
              <img src={photo} alt={`foto ${i + 1}`} onclick={() => setMainPhoto(photo)} />
              {#if canEdit}
                <button class="remove-photo" onclick={() => removePhoto(i)} title="Remover">✕</button>
              {/if}
            </div>
          {/each}
          {#if !piece.textureUrl && !(piece.photos?.length)}
            <div class="no-photos">Nenhuma foto. Adicione para personalizar.</div>
          {/if}
        </div>
      </section>

      <!-- ── HP Tracker (only for personagem) ──────────────────── -->
      {#if piece.class === 'personagem'}
        <section class="sheet-section">
          <h3 class="section-label">❤️ Pontos de Vida</h3>
          <div class="hp-bar-track">
            <div
              class="hp-bar-fill"
              style="width: {hpPercent}%; background: {hpColor};"
            ></div>
            <span class="hp-bar-label">{hpPercent.toFixed(0)}%</span>
          </div>
          <div class="hp-controls">
            {#if canEditSheet}
              <button class="hp-btn hp-minus" onclick={() => adjustHp(-5)} title="-5 HP">−5</button>
              <button class="hp-btn hp-minus" onclick={() => adjustHp(-1)} title="-1 HP">−1</button>
            {/if}
            <div class="hp-values">
              {#if canEditSheet}
                <input
                  type="number"
                  class="hp-input"
                  value={piece.hp ?? 0}
                  min="0"
                  max={piece.maxHp ?? 9999}
                  oninput={(e) => setHp(e.target.value)}
                />
              {:else}
                <span class="hp-readonly">{piece.hp ?? 0}</span>
              {/if}
              <span class="hp-sep">/</span>
              {#if canEdit}
                <input
                  type="number"
                  class="hp-input hp-max"
                  value={piece.maxHp ?? 100}
                  min="1"
                  oninput={(e) => setMaxHp(e.target.value)}
                />
              {:else}
                <span class="hp-readonly">{piece.maxHp ?? 100}</span>
              {/if}
            </div>
            {#if canEditSheet}
              <button class="hp-btn hp-plus" onclick={() => adjustHp(1)} title="+1 HP">+1</button>
              <button class="hp-btn hp-plus" onclick={() => adjustHp(5)} title="+5 HP">+5</button>
            {/if}
          </div>
          {#if canEditSheet}
            <div class="quick-hp-adjust" style="margin-top: 0.75rem; display: flex; gap: 0.5rem; align-items: center;">
              <input
                type="text"
                placeholder="Ex: -15 ou +10"
                class="quick-hp-input"
                style="flex: 1; padding: 0.35rem; border-radius: 6px; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; text-align: center; font-size: 0.85rem;"
                onkeydown={(e) => {
                  if (e.key === 'Enter') {
                    applyQuickHp(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
              <button
                onclick={(e) => {
                  const input = e.currentTarget.previousElementSibling;
                  applyQuickHp(input.value);
                  input.value = '';
                }}
                style="padding: 0.35rem 0.75rem; border-radius: 6px; background: #6366f1; border: none; color: #fff; font-size: 0.85rem; font-weight: bold; cursor: pointer;"
              >
                Aplicar
              </button>
            </div>
          {/if}
        </section>
      {/if}

      <!-- ── EP Tracker (only for personagem) ─────────────────── -->
      {#if piece.class === 'personagem'}
        <section class="sheet-section">
          <h3 class="section-label">⚡ Energia (EP)</h3>
          <div class="hp-bar-track">
            <div
              class="hp-bar-fill"
              style="width: {epPercent}%; background: linear-gradient(90deg, #0ea5e9, #38bdf8);"
            ></div>
            <span class="hp-bar-label">{epPercent.toFixed(0)}%</span>
          </div>
          <div class="hp-controls">
            {#if canEditSheet}
              <button class="hp-btn hp-minus" onclick={() => adjustEp(-5)} title="-5 EP">−5</button>
              <button class="hp-btn hp-minus" onclick={() => adjustEp(-1)} title="-1 EP">−1</button>
            {/if}
            <div class="hp-values">
              {#if canEditSheet}
                <input
                  type="number"
                  class="hp-input"
                  value={piece.ep ?? 0}
                  min="0"
                  max={piece.maxEp ?? 9999}
                  oninput={(e) => setEp(e.target.value)}
                />
              {:else}
                <span class="hp-readonly">{piece.ep ?? 0}</span>
              {/if}
              <span class="hp-sep">/</span>
              {#if canEdit}
                <input
                  type="number"
                  class="hp-input hp-max"
                  value={piece.maxEp ?? 100}
                  min="1"
                  oninput={(e) => setMaxEp(e.target.value)}
                />
              {:else}
                <span class="hp-readonly">{piece.maxEp ?? 100}</span>
              {/if}
            </div>
            {#if canEditSheet}
              <button class="hp-btn hp-plus" onclick={() => adjustEp(1)} title="+1 EP">+1</button>
              <button class="hp-btn hp-plus" onclick={() => adjustEp(5)} title="+5 EP">+5</button>
            {/if}
          </div>
        </section>
      {/if}

      <!-- ── Ações de Combate (Dash) ───────────────────────────── -->
      {#if piece.class === 'personagem'}
        <section class="sheet-section">
          <h3 class="section-label">💨 Ações de Combate</h3>

          {#if canEdit}
            <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; font-weight: 600;">Configurar Dash (GM)</div>
            <div class="prop-grid" style="margin-bottom: 0.75rem;">
              <div class="prop-row">
                <label class="prop-label">Alcance (hex)</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="1" max="10" step="1"
                    value={piece.dashRange ?? 3}
                    oninput={(e) => networkState.updatePieceSheet(piece.id, { dashRange: Number(e.target.value) })}
                    class="prop-slider ep-slider"
                  />
                  <span class="prop-val">{piece.dashRange ?? 3}✦</span>
                </div>
              </div>
              <div class="prop-row">
                <label class="prop-label">Custo EP</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0" max="100" step="5"
                    value={piece.dashEpCost ?? 20}
                    oninput={(e) => networkState.updatePieceSheet(piece.id, { dashEpCost: Number(e.target.value) })}
                    class="prop-slider ep-slider"
                  />
                  <span class="prop-val">{piece.dashEpCost ?? 20}EP</span>
                </div>
              </div>
            </div>
          {/if}

          <!-- Dash Button — visible to all, enabled only if enough EP -->
          {#if piece.class === 'personagem'}
            {@const dashCost = piece.dashEpCost ?? 20}
            {@const currentEp = piece.ep ?? 0}
            {@const canDash = currentEp >= dashCost && !networkState.dashMode}
            <button
              class="dash-btn {networkState.dashMode && networkState.selectedPieceId === piece.id ? 'dash-active' : ''}"
              disabled={!canDash && !(networkState.dashMode && networkState.selectedPieceId === piece.id)}
              onclick={() => {
                if (networkState.dashMode && networkState.selectedPieceId === piece.id) {
                  networkState.dashMode = false;
                } else if (canDash) {
                  networkState.selectedPieceId = piece.id;
                  networkState.dashMode = true;
                }
              }}
              title={canDash ? `Dash: move até ${piece.dashRange ?? 3} hexes por ${dashCost} EP` : `EP insuficiente (${currentEp}/${dashCost})`}
            >
              {#if networkState.dashMode && networkState.selectedPieceId === piece.id}
                ❌ Cancelar Dash
              {:else}
                💨 Usar Dash ({dashCost} EP)
              {/if}
            </button>
            {#if currentEp < dashCost}
              <div style="font-size: 0.7rem; color: #64748b; text-align: center; margin-top: 0.35rem;">EP insuficiente ({currentEp}/{dashCost})</div>
            {/if}
          {/if}
        </section>
      {/if}

      <!-- ── Efeitos ───────────────────────────────────────────── -->
      {#if piece.class === 'personagem'}
        <section class="sheet-section">
          <h3 class="section-label">✨ Efeitos</h3>
          
          <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem; font-weight: 600;">Animações de Impacto</div>
          <div class="effect-buttons" style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
            <button 
              class="effect-btn damage-effect-btn" 
              onclick={() => networkState.triggerPieceEffect(piece.id, 'damage')}
              style="flex: 1; padding: 0.45rem; border-radius: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; transition: all 0.2s; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;"
              onmouseover={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.3)'; e.target.style.color = '#fff'; }}
              onmouseout={(e) => { e.target.style.background = 'rgba(239, 68, 68, 0.15)'; e.target.style.color = '#f87171'; }}
            >
              💥 Dano (Vermelho)
            </button>
            <button 
              class="effect-btn heal-effect-btn" 
              onclick={() => networkState.triggerPieceEffect(piece.id, 'heal')}
              style="flex: 1; padding: 0.45rem; border-radius: 8px; font-size: 0.75rem; font-weight: bold; cursor: pointer; transition: all 0.2s; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.4); color: #4ade80;"
              onmouseover={(e) => { e.target.style.background = 'rgba(34, 197, 94, 0.3)'; e.target.style.color = '#fff'; }}
              onmouseout={(e) => { e.target.style.background = 'rgba(34, 197, 94, 0.15)'; e.target.style.color = '#4ade80'; }}
            >
              💚 Cura (Verde)
            </button>
          </div>

          <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.35rem; font-weight: 600;">Estados do Personagem</div>
          <div class="status-buttons">
            <button 
              class="status-btn {piece.dead ? 'active-dead' : ''}" 
              onclick={() => networkState.updatePieceSheet(piece.id, { dead: !piece.dead })}
              disabled={!canEditSheet}
              title={canEditSheet ? "Alternar estado Morto" : "Apenas o controlador ou mestre pode alterar o estado"}
            >
              💀 Morto
            </button>
            <button 
              class="status-btn {piece.stunned ? 'active-stunned' : ''}" 
              onclick={() => networkState.updatePieceSheet(piece.id, { stunned: !piece.stunned })}
              disabled={!canEditSheet}
              title={canEditSheet ? "Alternar estado Atordoado" : "Apenas o controlador ou mestre pode alterar o estado"}
            >
              💫 Atordoado
            </button>
          </div>
        </section>
      {/if}

      <!-- ── Structure Properties (GM only) ───────────────────── -->
      {#if isStructure && canEdit}
        <section class="sheet-section">
          <h3 class="section-label">⚙️ Propriedades da Estrutura</h3>
          <div class="prop-grid">

            {#if piece.structureType === 'wall-line' || piece.structureType === 'house'}
              <div class="prop-row">
                <label class="prop-label">Altura</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.1" max="15" step="0.1"
                    value={piece.height ?? 2.0}
                    oninput={(e) => updateStructureProp('height', e.target.value)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.height ?? 2.0).toFixed(1)}u</span>
                </div>
              </div>
            {/if}

            {#if piece.structureType === 'wall-line'}
              <div class="prop-row">
                <label class="prop-label">Espessura</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.05" max="2.0" step="0.05"
                    value={piece.thickness ?? 0.15}
                    oninput={(e) => updateStructureProp('thickness', e.target.value)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.thickness ?? 0.15).toFixed(2)}u</span>
                </div>
              </div>
            {/if}

            {#if piece.structureType === 'house' || piece.structureType === 'floor-plane'}
              <div class="prop-row">
                <label class="prop-label">Largura (X)</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.5" max="24" step="0.5"
                    value={piece.width ?? 4}
                    oninput={(e) => updateStructureProp('width', e.target.value)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.width ?? 4).toFixed(1)}</span>
                </div>
              </div>
              <div class="prop-row">
                <label class="prop-label">Profundidade (Z)</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.5" max="24" step="0.5"
                    value={piece.depth ?? 4}
                    oninput={(e) => updateStructureProp('depth', e.target.value)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.depth ?? 4).toFixed(1)}</span>
                </div>
              </div>
            {/if}

            {#if piece.structureType === '3d-shape'}
              <div class="prop-row">
                <label class="prop-label">Largura (X)</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.05" max="24" step="0.05"
                    value={piece.width ?? 2}
                    oninput={(e) => updateStructureProp('width', e.target.value)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.width ?? 2).toFixed(2)}</span>
                </div>
              </div>
              <div class="prop-row">
                <label class="prop-label">Profundidade (Z)</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.05" max="24" step="0.05"
                    value={piece.depth ?? 2}
                    oninput={(e) => updateStructureProp('depth', e.target.value)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.depth ?? 2).toFixed(2)}</span>
                </div>
              </div>
              <div class="prop-row">
                <label class="prop-label">Altura (Y)</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.1" max="15" step="0.1"
                    value={piece.height ?? 2}
                    oninput={(e) => updateStructureProp('height', e.target.value)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.height ?? 2).toFixed(1)}</span>
                </div>
              </div>
              <div class="prop-row">
                <label class="prop-label">Rotação</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0" max="360" step="5"
                    value={Math.round(((piece.rotation ?? 0) * 180) / Math.PI) % 360}
                    oninput={(e) => updateStructureProp('rotation', (Number(e.target.value) * Math.PI) / 180)}
                    class="prop-slider"
                  />
                  <span class="prop-val">{Math.round(((piece.rotation ?? 0) * 180) / Math.PI) % 360}°</span>
                </div>
              </div>
            {/if}

            {#if canEdit}
              <div class="prop-row">
                <label class="prop-label">Posição X</label>
                <input
                  type="number"
                  step="1"
                  value={piece.x}
                  oninput={(e) => updateStructureProp('x', e.target.value)}
                  style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: monospace; outline: none; width: 100%;"
                />
              </div>
              <div class="prop-row">
                <label class="prop-label">Posição Y (Altura)</label>
                <input
                  type="number"
                  step="0.05"
                  value={piece.y ?? 0}
                  oninput={(e) => updateStructureProp('y', e.target.value)}
                  style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: monospace; outline: none; width: 100%;"
                />
              </div>
              <div class="prop-row">
                <label class="prop-label">Posição Z</label>
                <input
                  type="number"
                  step="1"
                  value={piece.z}
                  oninput={(e) => updateStructureProp('z', e.target.value)}
                  style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: monospace; outline: none; width: 100%;"
                />
              </div>
            {/if}

            <div class="prop-row">
              <label class="prop-label">Andar</label>
              <select
                value={Math.round((piece.y ?? 0) / 2.0) + 1}
                onchange={(e) => updateStructureProp('y', (Number(e.target.value) - 1) * 2.0)}
                class="prop-select"
                style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: monospace; outline: none; width: 100%;"
              >
                <option value="1">1º Andar (Térreo)</option>
                <option value="2">2º Andar</option>
                <option value="3">3º Andar</option>
                <option value="4">4º Andar</option>
                <option value="5">5º Andar</option>
                <option value="6">6º Andar</option>
              </select>
            </div>

            <!-- Color picker -->
            <div class="prop-row">
              <label class="prop-label">Cor</label>
              <input
                type="color"
                value={piece.color}
                onchange={(e) => networkState.updatePieceDetails(piece.id, { color: e.target.value })}
                class="prop-color"
              />
            </div>

            <!-- Texture upload -->
            <div class="prop-row">
              <label class="prop-label">Textura</label>
              <div style="display: flex; gap: 0.35rem; width: 100%;">
                <label class="tex-upload-btn" style="flex: 1; margin: 0; text-align: center;">
                  {piece.textureUrl ? '🔄 Alterar' : '📁 Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    onchange={uploadTextureFromInput}
                  />
                </label>
                <button
                  type="button"
                  class="tex-upload-btn"
                  style="background: rgba(168, 85, 247, 0.2); border-color: #a855f7; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.25rem;"
                  onclick={() => showTexturePopup = true}
                >
                  🎨 Galeria
                </button>
              </div>
            </div>
          </div>
        </section>
      {/if}

      <!-- ── Wall Openings Section (GM only) ────────────────── -->
      {#if piece && piece.structureType === 'wall-line' && canEdit}
        <section class="sheet-section" style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 0.85rem 1rem;">
          <h3 class="section-label" style="margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
            <span>🚪 Portas e Janelas</span>
            <div style="display: flex; gap: 0.4rem;">
              <button
                onclick={() => networkState.addWallOpening(piece.id, 'door')}
                style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); color: #c084fc; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold; cursor: pointer; transition: all 0.2s;"
                onmouseover={(e) => e.target.style.background = 'rgba(168, 85, 247, 0.3)'}
                onmouseout={(e) => e.target.style.background = 'rgba(168, 85, 247, 0.15)'}
              >
                + Porta
              </button>
              <button
                onclick={() => networkState.addWallOpening(piece.id, 'window')}
                style="background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); color: #22d3ee; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: bold; cursor: pointer; transition: all 0.2s;"
                onmouseover={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.3)'}
                onmouseout={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.15)'}
              >
                + Janela
              </button>
            </div>
          </h3>

          {#if !piece.openings || piece.openings.length === 0}
            <div style="font-size: 0.75rem; color: #475569; font-style: italic; padding: 0.25rem 0;">
              Nenhuma abertura nesta parede.
            </div>
          {:else}
            <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-top: 0.5rem;">
              {#each piece.openings as op (op.id)}
                <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); padding: 0.6rem; border-radius: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <span style="font-size: 0.72rem; font-weight: 900; font-family: monospace; color: {op.type === 'door' ? '#c084fc' : '#22d3ee'}">
                      {op.type === 'door' ? 'PORTA' : 'JANELA'}
                    </span>
                    <button
                      onclick={() => networkState.removeWallOpening(piece.id, op.id)}
                      style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.6rem; cursor: pointer;"
                    >
                      Excluir
                    </button>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                    <!-- Position Slider -->
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; color: #94a3b8;">
                      <span style="width: 70px;">Posição</span>
                      <input
                        type="range" min="0.05" max="0.95" step="0.01"
                        value={op.position}
                        oninput={(e) => networkState.updateWallOpening(piece.id, op.id, { position: Number(e.target.value) })}
                        style="flex: 1; margin: 0 0.5rem;"
                      />
                      <span style="font-family: monospace; width: 35px; text-align: right;">{(op.position * 100).toFixed(0)}%</span>
                    </div>

                    <!-- Width Slider -->
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; color: #94a3b8;">
                      <span style="width: 70px;">Largura</span>
                      <input
                        type="range" min="0.2" max="3.0" step="0.1"
                        value={op.width}
                        oninput={(e) => networkState.updateWallOpening(piece.id, op.id, { width: Number(e.target.value) })}
                        style="flex: 1; margin: 0 0.5rem;"
                      />
                      <span style="font-family: monospace; width: 35px; text-align: right;">{op.width.toFixed(1)}m</span>
                    </div>

                    <!-- Height Slider -->
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; color: #94a3b8;">
                      <span style="width: 70px;">Altura</span>
                      <input
                        type="range" min="0.2" max="3.0" step="0.1"
                        value={op.height}
                        oninput={(e) => networkState.updateWallOpening(piece.id, op.id, { height: Number(e.target.value) })}
                        style="flex: 1; margin: 0 0.5rem;"
                      />
                      <span style="font-family: monospace; width: 35px; text-align: right;">{op.height.toFixed(1)}m</span>
                    </div>

                    <!-- Offset Slider (Window only) -->
                    {#if op.type === 'window'}
                      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; color: #94a3b8;">
                        <span style="width: 70px;">Elevação</span>
                        <input
                          type="range" min="0.0" max="2.0" step="0.1"
                          value={op.yOffset}
                          oninput={(e) => networkState.updateWallOpening(piece.id, op.id, { yOffset: Number(e.target.value) })}
                          style="flex: 1; margin: 0 0.5rem;"
                        />
                        <span style="font-family: monospace; width: 35px; text-align: right;">{op.yOffset.toFixed(1)}m</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <!-- ── Non-structure piece properties (Elevation available to player, others to GM) ─────────── -->
      {#if !isStructure && (canEdit || canEditSheet)}
        <section class="sheet-section">
          <h3 class="section-label">⚙️ Propriedades</h3>
          <div class="prop-grid">
            {#if canEdit}
              <div class="prop-row">
                <label class="prop-label">Nome</label>
                <input
                  type="text"
                  class="prop-text-input"
                  value={piece.name}
                  onblur={(e) => networkState.updatePieceDetails(piece.id, { name: e.target.value })}
                />
              </div>
              <div class="prop-row">
                <label class="prop-label">Cor</label>
                <input
                  type="color"
                  value={piece.color}
                  onchange={(e) => networkState.updatePieceDetails(piece.id, { color: e.target.value })}
                  class="prop-color"
                />
              </div>
              <div class="prop-row">
                <label class="prop-label">Foto</label>
                <div style="display: flex; gap: 0.35rem; width: 100%;">
                  <label class="tex-upload-btn" style="flex: 1; margin: 0; text-align: center;">
                    {piece.textureUrl ? '🔄 Alterar' : '📁 Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      onchange={uploadTextureFromInput}
                    />
                  </label>
                  <button
                    type="button"
                    class="tex-upload-btn"
                    style="background: rgba(6, 182, 212, 0.2); border-color: #06b6d4; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.25rem;"
                    onclick={() => showBleachPopup = true}
                  >
                    🎭 Coleção
                  </button>
                </div>
              </div>
            {/if}
            {#if canEditSheet}
              <div class="prop-row">
                <label class="prop-label">Andar</label>
                <select
                  value={Math.round((piece.y ?? 0) / 2.0) + 1}
                  onchange={(e) => {
                    const level = Number(e.target.value);
                    const newY = (level - 1) * 2.0;
                    if (networkState.role === 'host') {
                      networkState.updatePieceDetails(piece.id, { y: newY });
                    } else {
                      networkState.requestMove(piece.id, piece.x, newY, piece.z);
                    }
                  }}
                  class="prop-select"
                  style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: monospace; outline: none; width: 100%;"
                >
                  <option value="1">1º Andar (Térreo)</option>
                  <option value="2">2º Andar</option>
                  <option value="3">3º Andar</option>
                  <option value="4">4º Andar</option>
                  <option value="5">5º Andar</option>
                  <option value="6">6º Andar</option>
                </select>
              </div>
            {/if}
            {#if canEdit}
              <div class="prop-row">
                <label class="prop-label">Escala</label>
                <div class="prop-input-row">
                  <input
                    type="range" min="0.5" max="3.0" step="0.1"
                    value={piece.scale ?? 1.0}
                    oninput={(e) => {
                      networkState.updatePieceDetails(piece.id, { scale: Number(e.target.value) });
                    }}
                    class="prop-slider"
                  />
                  <span class="prop-val">{(piece.scale ?? 1.0).toFixed(1)}x</span>
                </div>
              </div>
              <div class="prop-row" style="display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0;">
                <label class="prop-label" style="margin: 0; cursor: pointer;">Inverter Imagem</label>
                <input
                  type="checkbox"
                  checked={!!piece.flipX}
                  onchange={(e) => networkState.updatePieceDetails(piece.id, { flipX: e.currentTarget.checked })}
                  style="width: 1.2rem; height: 1.2rem; cursor: pointer; accent-color: #a855f7;"
                />
              </div>
            {/if}
          </div>
        </section>
      {/if}

      <!-- ── Notes / Annotations ───────────────────────────────── -->
      <section class="sheet-section notes-section">
        <h3 class="section-label">📝 Anotações</h3>
        {#if canEditSheet}
          <textarea
            class="notes-textarea"
            placeholder="Escreva notas, habilidades, backstory, status..."
            bind:value={localNotes}
            onblur={saveNotes}
            rows="5"
          ></textarea>
          <button class="save-notes-btn" onclick={saveNotes}>Salvar Notas</button>
        {:else}
          <div class="notes-readonly">
            {piece.notes?.trim() || '(Nenhuma anotação)'}
          </div>
        {/if}
      </section>

      <!-- ── Danger Zone (GM delete) ────────────────────────────── -->
      {#if canEdit}
        <section class="sheet-section danger-section">
          <button class="delete-btn" onclick={() => { networkState.deletePiece(piece.id); }}>
            🗑️ Excluir Peça
          </button>
        </section>
      {/if}

    </div>
  </aside>
{/if}

{#if showTexturePopup && piece}
  <div class="sheet-popup-overlay" onclick={() => showTexturePopup = false}>
    <div class="sheet-popup-card" onclick={(e) => e.stopPropagation()}>
      <div class="popup-title-row">
        <h4>🎨 Texturas Padrão</h4>
        <button class="popup-close-x" onclick={() => showTexturePopup = false}>✕</button>
      </div>
      <div class="popup-grid-container">
        {#each standardTextures as tex}
          <button class="popup-grid-item" onclick={() => { networkState.updatePieceTexture(piece.id, tex.path); showTexturePopup = false; }}>
            <img src={tex.path} alt={tex.name} class="popup-item-thumb" />
            <span class="popup-item-name">{tex.name}</span>
          </button>
        {/each}
        <button class="popup-grid-item" style="background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2);" onclick={() => { networkState.updatePieceTexture(piece.id, ''); showTexturePopup = false; }}>
          <div class="popup-item-thumb no-tex-thumb">✕</div>
          <span class="popup-item-name" style="color: #f87171;">Sem Textura</span>
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showBleachPopup && piece}
  <div class="sheet-popup-overlay" onclick={() => showBleachPopup = false}>
    <div class="sheet-popup-card bleach-card" onclick={(e) => e.stopPropagation()}>
      <div class="popup-title-row">
        <h4>🎭 Coleção Bleach</h4>
        <button class="popup-close-x" onclick={() => showBleachPopup = false}>✕</button>
      </div>
      <div class="popup-grid-container bleach-grid">
        {#each bleachCollection as item}
          <button class="popup-grid-item" onclick={() => { networkState.updatePieceTexture(piece.id, item.path); showBleachPopup = false; }}>
            <img src={item.path} alt={item.name} class="popup-item-thumb character-thumb" />
            <span class="popup-item-name">{item.name}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: transparent;
    cursor: default;
  }

  .character-sheet {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 400px;
    z-index: 201;
    display: flex;
    flex-direction: column;
    background: rgba(9, 6, 22, 0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-left: 1px solid rgba(168, 85, 247, 0.2);
    box-shadow: -20px 0 60px rgba(0, 0, 0, 0.8);
    animation: slideIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    overflow: hidden;
    font-family: 'Inter', 'Outfit', system-ui, sans-serif;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  .sheet-close {
    position: absolute;
    top: 0.75rem;
    right: 0.85rem;
    z-index: 10;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .sheet-close:hover { background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: #ef4444; }

  /* ── Header ─────────────────────────────────────────────────────── */
  .sheet-header {
    position: relative;
    padding: 1.25rem 1rem 1rem;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .header-accent-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent, #a855f7), transparent);
  }

  .header-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .piece-avatar {
    position: relative;
    flex-shrink: 0;
  }

  .avatar-img {
    width: 240px;
    height: 240px;
    border-radius: 24px;
    object-fit: cover;
    border: 4px solid var(--accent, #a855f7);
    box-shadow: 0 0 32px rgba(168, 85, 247, 0.5);
  }

  .avatar-initials {
    width: 240px;
    height: 240px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 4.5rem;
    font-weight: 900;
    color: #fff;
    border: 4px solid var(--accent, #a855f7);
    box-shadow: 0 0 32px rgba(168, 85, 247, 0.5);
  }

  .avatar-badge {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.55rem;
    font-weight: 900;
    letter-spacing: 0.08rem;
    padding: 0.12rem 0.4rem;
    border-radius: 99px;
    white-space: nowrap;
  }

  .badge-char { background: #7c3aed; color: #e9d5ff; }
  .badge-obj  { background: #0e7490; color: #cffafe; }

  .header-info {
    flex: 1;
    min-width: 0;
    padding-top: 0.25rem;
  }

  .piece-name {
    font-size: 1.05rem;
    font-weight: 800;
    color: #f1f5f9;
    margin: 0 0 0.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .piece-type {
    font-size: 0.72rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06rem;
    font-family: monospace;
  }

  /* ── Body ────────────────────────────────────────────────────────── */
  .sheet-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(168, 85, 247, 0.3) transparent;
  }

  .sheet-section {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .section-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
  }

  .section-label {
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.08rem;
    color: #a855f7;
    text-transform: uppercase;
    margin: 0 0 0.6rem;
    font-family: monospace;
  }

  .section-title-row .section-label { margin: 0; }

  /* ── Photo Gallery ───────────────────────────────────────────────── */
  .add-photo-btn {
    font-size: 0.7rem;
    color: #06b6d4;
    border: 1px solid rgba(6, 182, 212, 0.3);
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(6, 182, 212, 0.05);
  }
  .add-photo-btn:hover { background: rgba(6, 182, 212, 0.15); }
  .add-photo-btn input { display: none; }

  .photo-gallery {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .photo-thumb {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.1);
    transition: border-color 0.2s;
    cursor: pointer;
    flex-shrink: 0;
  }

  .photo-thumb:hover { border-color: #a855f7; }

  .active-thumb { border-color: rgba(6, 182, 212, 0.6); }

  .photo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumb-label {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.75);
    font-size: 0.55rem;
    text-align: center;
    color: #22d3ee;
    padding: 0.1rem;
    font-weight: 700;
  }

  .remove-photo {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(239, 68, 68, 0.85);
    color: #fff;
    border: none;
    border-radius: 4px;
    width: 16px;
    height: 16px;
    font-size: 0.55rem;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .photo-thumb:hover .remove-photo { display: flex; }

  .no-photos {
    font-size: 0.75rem;
    color: #475569;
    font-style: italic;
    padding: 0.5rem 0;
  }

  /* ── HP Bar ──────────────────────────────────────────────────────── */
  .hp-bar-track {
    position: relative;
    height: 20px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .hp-bar-fill {
    height: 100%;
    border-radius: 10px;
    transition: width 0.4s ease, background 0.4s ease;
  }

  .hp-bar-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.9);
    pointer-events: none;
  }

  .hp-controls {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    justify-content: center;
  }

  .hp-btn {
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
  }

  .hp-minus {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }
  .hp-minus:hover { background: rgba(239, 68, 68, 0.25); }

  .hp-plus {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #4ade80;
  }
  .hp-plus:hover { background: rgba(34, 197, 94, 0.25); }

  .hp-values {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.15rem 0.4rem;
  }

  .hp-input {
    width: 44px;
    background: transparent;
    border: none;
    outline: none;
    color: #f1f5f9;
    font-size: 0.9rem;
    font-weight: 700;
    text-align: center;
    font-family: monospace;
  }

  .hp-input.hp-max { color: #94a3b8; }
  .hp-sep { color: #475569; font-size: 1rem; }
  .hp-readonly { font-size: 0.9rem; font-weight: 700; font-family: monospace; color: #f1f5f9; }

  /* ── Structure Properties ────────────────────────────────────────── */
  .prop-grid {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .prop-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .prop-label {
    font-size: 0.72rem;
    color: #64748b;
    width: 90px;
    flex-shrink: 0;
    text-transform: uppercase;
    letter-spacing: 0.04rem;
  }

  .prop-input-row {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .prop-slider {
    flex: 1;
    accent-color: #a855f7;
    height: 4px;
    cursor: pointer;
  }

  .prop-val {
    font-size: 0.72rem;
    color: #c084fc;
    font-family: monospace;
    width: 36px;
    text-align: right;
    flex-shrink: 0;
  }

  .prop-color {
    width: 36px;
    height: 28px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
    padding: 0;
  }

  .prop-text-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
    border-radius: 6px;
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
    outline: none;
  }
  .prop-text-input:focus { border-color: #a855f7; }

  .tex-upload-btn {
    font-size: 0.72rem;
    color: #06b6d4;
    border: 1px solid rgba(6, 182, 212, 0.3);
    padding: 0.25rem 0.65rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(6, 182, 212, 0.05);
    white-space: nowrap;
  }
  .tex-upload-btn:hover { background: rgba(6, 182, 212, 0.15); }
  .tex-upload-btn input { display: none; }

  /* ── Notes ───────────────────────────────────────────────────────── */
  .notes-section { flex: 1; }

  .notes-textarea {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #cbd5e1;
    font-size: 0.82rem;
    font-family: 'Inter', system-ui, sans-serif;
    line-height: 1.5;
    padding: 0.65rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.2s;
  }
  .notes-textarea:focus { border-color: rgba(168, 85, 247, 0.5); }

  .save-notes-btn {
    margin-top: 0.5rem;
    width: 100%;
    padding: 0.45rem;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    color: #c084fc;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .save-notes-btn:hover { background: rgba(168, 85, 247, 0.25); color: #fff; }

  .notes-readonly {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 0.65rem;
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.5;
    white-space: pre-wrap;
    min-height: 80px;
  }

  /* ── Danger Zone ─────────────────────────────────────────────────── */
  .danger-section { border-bottom: none; padding-top: 0.5rem; }

  .delete-btn {
    width: 100%;
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #f87171;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .delete-btn:hover { background: rgba(239, 68, 68, 0.2); color: #fff; }

  /* ── Status States ───────────────────────────────────────────────── */
  .status-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.4rem;
  }
  .status-btn {
    flex: 1;
    padding: 0.5rem;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
  }
  .status-btn.active-dead {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.6);
    color: #f87171;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
  }
  .status-btn.active-stunned {
    background: rgba(234, 179, 8, 0.25);
    border-color: rgba(234, 179, 8, 0.6);
    color: #facc15;
    box-shadow: 0 0 8px rgba(234, 179, 8, 0.3);
  }
  .status-btn:hover:not(.active-dead):not(.active-stunned) {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .dash-btn {
    width: 100%;
    padding: 0.6rem 1rem;
    border-radius: 10px;
    font-size: 0.82rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(56, 189, 248, 0.1));
    border: 1.5px solid rgba(6, 182, 212, 0.4);
    color: #38bdf8;
    letter-spacing: 0.04rem;
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.15);
  }
  .dash-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(56, 189, 248, 0.2));
    border-color: #06b6d4;
    color: #fff;
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.4);
    transform: translateY(-1px);
  }
  .dash-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none;
  }
  .dash-btn.dash-active {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(248, 113, 113, 0.1));
    border-color: rgba(239, 68, 68, 0.6);
    color: #f87171;
    animation: dashPulse 1s ease-in-out infinite;
    box-shadow: 0 0 16px rgba(239, 68, 68, 0.3);
  }
  @keyframes dashPulse {
    0% { box-shadow: 0 0 8px rgba(6, 182, 212, 0.3); }
    50% { box-shadow: 0 0 22px rgba(6, 182, 212, 0.7); }
    100% { box-shadow: 0 0 8px rgba(6, 182, 212, 0.3); }
  }

  .ep-slider::-webkit-slider-thumb {
    background: #38bdf8;
  }
  .ep-slider::-moz-range-thumb {
    background: #38bdf8;
  }
  .ep-slider::-webkit-slider-runnable-track {
    background: linear-gradient(90deg, #0ea5e9 var(--val, 50%), rgba(255,255,255,0.1) var(--val, 50%));
  }

  /* ── Popups ── */
  .sheet-popup-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sheet-popup-card {
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 400px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .sheet-popup-card.bleach-card {
    max-width: 600px;
    border-color: rgba(6, 182, 212, 0.3);
  }
  .popup-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.5rem;
  }
  .popup-title-row h4 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: bold;
    color: #e2e8f0;
  }
  .popup-close-x {
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    transition: color 0.2s;
  }
  .popup-close-x:hover {
    color: #ef4444;
  }
  .popup-grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 0.75rem;
    overflow-y: auto;
  }
  .popup-grid-item {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s;
  }
  .popup-grid-item:hover {
    background: rgba(168, 85, 247, 0.15);
    border-color: #a855f7;
    transform: translateY(-2px);
  }
  .bleach-grid .popup-grid-item:hover {
    background: rgba(6, 182, 212, 0.15);
    border-color: #06b6d4;
  }
  .popup-item-thumb {
    width: 80px;
    height: 80px;
    border-radius: 6px;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .popup-item-thumb.character-thumb {
    border-radius: 50%;
  }
  .popup-item-name {
    font-size: 0.7rem;
    color: #cbd5e1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .no-tex-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    font-size: 1.5rem;
    font-weight: bold;
    border-color: rgba(239, 68, 68, 0.3);
    width: 80px;
    height: 80px;
    border-radius: 6px;
  }
</style>
