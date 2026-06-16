<script>
  import Lobby from './lib/components/Lobby.svelte';
  import Board from './lib/components/Board.svelte';
  import CharacterSheet from './lib/components/CharacterSheet.svelte';
  import { networkState } from './lib/networkState.svelte.js';

  let showMenu = $state(true);
</script>

<svelte:head>
  <title>Aethelgard - 2.5D Soul Board VTT</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Outfit:wght@400;600;900&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
</svelte:head>

<main class="app-main">
  <!-- Glowing background particles simulation -->
  <div class="reiatsu-background">
    <div class="glow-orb purple-glow"></div>
    <div class="glow-orb cyan-glow"></div>
  </div>

  {#if networkState.role === 'disconnected'}
    <!-- Welcome Screen / Entry Gate -->
    <div class="welcome-screen">
      <div class="gate-seal"></div>
      <Lobby />
    </div>
  {:else}
    <!-- Active Session Workspace -->
    <div class="workspace-container">
      <header class="workspace-header">
        <div class="brand">
          <span class="brand-title">AETHELGARD // SOUL VTT</span>
          <span class="room-indicator">ROOM: {networkState.roomId}</span>
        </div>
        <div class="header-actions">
          <div class="floor-selector" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(168, 85, 247, 0.25); padding: 0.25rem 0.65rem; border-radius: 6px; box-shadow: 0 0 10px rgba(168, 85, 247, 0.1);">
            <span style="font-size: 0.75rem; color: #a855f7; font-family: monospace; font-weight: 900; letter-spacing: 0.05rem;">VIEW LVL: {networkState.currentViewLevel}</span>
            <button 
              onclick={() => { if (networkState.currentViewLevel > 1) networkState.currentViewLevel--; }}
              class="vtt-btn" 
              style="padding: 0.15rem 0.4rem; line-height: 1; font-size: 0.7rem; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); color: #a855f7; cursor: pointer; border-radius: 4px;"
              title="Go Down Floor"
            >
              ▼
            </button>
            <button 
              onclick={() => { networkState.currentViewLevel++; }}
              class="vtt-btn" 
              style="padding: 0.15rem 0.4rem; line-height: 1; font-size: 0.7rem; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); color: #a855f7; cursor: pointer; border-radius: 4px;"
              title="Go Up Floor"
            >
              ▲
            </button>
          </div>
          <button class="toggle-menu-btn" onclick={() => showMenu = !showMenu}>
            {showMenu ? '✕ Hide Controls' : '☰ Show Controls'}
          </button>
          <div class="user-badge {networkState.role === 'host' ? 'host-badge' : 'client-badge'}">
            {networkState.role === 'host' ? 'MASTER (GM)' : 'PLAYER'}
          </div>
        </div>
      </header>

      <div class="workspace-layout {showMenu ? 'menu-open' : 'menu-closed'}">
        <!-- 3D VTT Grid Canvas -->
        <section class="board-section">
          <Board />
        </section>

        <!-- Network Controls & Uplink Logs -->
        {#if showMenu}
          <section class="control-section">
            <Lobby />
          </section>
        {/if}
      </div>

      <!-- Character / Object Sheet side-panel overlay -->
      <CharacterSheet />
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #07040e;
    color: #e2e8f0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overflow: hidden;
    height: 100vh;
    user-select: none;
    -webkit-user-select: none;
  }

  :global(input, select, textarea) {
    user-select: text;
    -webkit-user-select: text;
  }

  .app-main {
    height: 100vh;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Spiritual reiatsu glows */
  .reiatsu-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -10;
    pointer-events: none;
    overflow: hidden;
  }

  .glow-orb {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    filter: blur(140px);
    opacity: 0.15;
    animation: drift 25s infinite alternate ease-in-out;
  }

  .purple-glow {
    background: radial-gradient(circle, #a855f7 0%, transparent 70%);
    top: -10%;
    left: -10%;
  }

  .cyan-glow {
    background: radial-gradient(circle, #06b6d4 0%, transparent 70%);
    bottom: -10%;
    right: -10%;
    animation-delay: -10s;
  }

  @keyframes drift {
    0% { transform: translate(0, 0) scale(1); }
    100% { transform: translate(100px, 80px) scale(1.15); }
  }

  /* Welcome Landing Gate */
  .welcome-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    box-sizing: border-box;
    position: relative;
  }

  .gate-seal {
    position: absolute;
    width: 450px;
    height: 450px;
    border: 1px dashed rgba(168, 85, 247, 0.08);
    border-radius: 50%;
    pointer-events: none;
    z-index: -1;
    animation: spin 60s infinite linear;
  }

  @keyframes spin {
    from { transform: rotate(0); }
    to { transform: rotate(360deg); }
  }

  /* Active Workspace Layout */
  .workspace-container {
    padding: 1rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100vh;
    width: 100%;
    max-width: none;
    margin: 0;
    overflow: hidden;
  }

  .workspace-header {
    height: 54px;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.5rem 1.5rem;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .brand-title {
    font-family: 'Outfit', sans-serif;
    font-weight: 900;
    letter-spacing: 0.15rem;
    background: linear-gradient(135deg, #a855f7 0%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .room-indicator {
    font-family: monospace;
    font-size: 0.8rem;
    color: #94a3b8;
    background: rgba(0, 0, 0, 0.3);
    padding: 0.25rem 0.65rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .user-badge {
    font-size: 0.75rem;
    font-weight: 900;
    padding: 0.3rem 0.85rem;
    border-radius: 6px;
    letter-spacing: 0.05rem;
  }

  .host-badge {
    background: #06b6d4;
    color: #0f172a;
    box-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
  }

  .client-badge {
    background: #a855f7;
    color: #fff;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .toggle-menu-btn {
    background: rgba(168, 85, 247, 0.1);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
    padding: 0.35rem 0.85rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.05rem;
  }

  .toggle-menu-btn:hover {
    background: rgba(168, 85, 247, 0.25);
    color: #fff;
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.25);
  }

  .workspace-layout {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }

  .board-section {
    flex: 1;
    height: 100%;
    min-height: 0;
    min-width: 0;
    position: relative;
  }

  .control-section {
    width: 420px;
    height: 100%;
    min-height: 0;
    flex-shrink: 0;
  }
</style>
