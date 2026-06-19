# 🏰 AETHELGARD: SOUL VTT // Virtual Table Top Supreme

*Disponível em Português e Inglês / Available in Portuguese and English*

---

## 🇧🇷 Português

**Aethelgard** é uma revolução completa na forma de mestrar e jogar RPG online. Desenvolvido com uma moderna arquitetura em **Svelte 5 (Runes)**, **Vite** e renderização 3D de alta performance com **Three.js / Threlte**, este tabuleiro virtual (VTT) elimina a necessidade de servidores centrais complexos ou assinaturas caras, entregando uma experiência imersiva diretamente no navegador.

### 🚀 A Revolução do Tabuleiro de RPG: Construção Dinâmica por Inteligência Artificial (MCP)

Aethelgard traz para o mundo do RPG o **Model Context Protocol (MCP)**, permitindo que você construa, altere e popule seus mapas tridimensionais em tempo real usando apenas **prompts em linguagem natural** através de uma Inteligência Artificial!

Imagine conversar com o seu co-piloto de IA e dizer:
> *"Crie uma masmorra abandonada com quatro salas interconectadas. Adicione portas de madeira nas entradas, coloque alguns baús trancados e barris de suprimentos nos cantos, e spawne três monstros na sala principal."*

A IA lê a lista de assets disponíveis do seu projeto (tokens, modelos 3D, texturas de pedra/madeira) e desenha paredes, portas, pisos, inimigos e detalhes automaticamente no tabuleiro em segundos!

### ✨ Recursos de Destaque (Features)

* **Motor 3D de Alta Performance (Three.js & Threlte)**: Visualização imersiva em 3D diretamente no browser. Suporte a formas geométricas customizadas e importação de modelos 3D (.glb / .gltf). Efeitos de partículas controlados pelo GM (explosões, reações mágicas, relâmpagos).
* **Conectividade Peer-to-Peer Autêntica (PeerJS)**: Sem servidores intermediários: conexões diretas WebRTC seguras de baixíssima latência entre o GM (Host) e os jogadores (Clients).
* **Fichas de Personagem Dinâmicas**: Fichas integradas com HP/EP e habilidades como *Dash*. Indicadores visuais de estados de combate (*Stun* e *Death State*).
* **Ambientes Multicamadas e Cenários**: Crie múltiplos cenários isolados, andares elevados (SketchUp style) e escadas interativas.
* **Modo Offline & Solo**: Jogue ou prepare sessões de forma 100% offline localmente, salvando e carregando arquivos JSON com um clique.

### 💻 Como Rodar o Projeto Localmente

1. **Instalação e Inicialização**:
   ```bash
   npm install
   npm run dev
   ```
   Acesse o link gerado (geralmente `http://localhost:5173`) no seu navegador.

2. **Executando o Assistente de Construção IA (MCP Server)**:
   ```bash
   node mcp-server.js
   ```
   Configure o servidor MCP em seu cliente de IA (como Cursor ou Claude Desktop) apontando para o arquivo `mcp-server.js`.

---

## 🇺🇸 English

**Aethelgard** is a complete revolution in hosting and playing tabletop RPGs online. Built with a modern architecture utilizing **Svelte 5 (Runes)**, **Vite**, and high-performance 3D rendering with **Three.js / Threlte**, this virtual tabletop (VTT) eliminates the need for complex central servers or expensive subscriptions, delivering an immersive experience directly in your browser.

### 🚀 The RPG Board Revolution: Dynamic Map Construction via AI (MCP)

Aethelgard brings the **Model Context Protocol (MCP)** to the RPG world, allowing you to build, modify, and populate your three-dimensional maps in real-time using only **natural language prompts** through an AI assistant!

Imagine chatting with your AI co-pilot and saying:
> *"Create an abandoned dungeon with four interconnected rooms. Add wooden doors at the entrances, place a few locked chests and supply barrels in the corners, and spawn three monsters in the main room."*

The AI reads the list of available assets from your project (tokens, 3D models, stone/wood textures) and automatically draws walls, doors, floors, enemies, and details on the board in seconds!

### ✨ Key Features

* **High-Performance 3D Engine (Three.js & Threlte)**: Immersive 3D rendering directly in the browser. Support for custom geometric shapes and direct import of 3D models (.glb / .gltf). Real-time particle effects controlled by the GM (spiritual bursts, magic reactions, lightning).
* **True Peer-to-Peer Connectivity (PeerJS)**: No intermediary servers—secure, ultra-low latency WebRTC direct connections between the GM (Host) and players (Clients).
* **Dynamic Character Sheets**: Interactive sheets integrated with HP/EP tracking and special abilities like *Dash*. Visual indicators for combat states (*Stun* and *Death State*).
* **Multi-layered Environments & Scenes**: Manage multiple isolated environments, elevated floors (SketchUp style), and interactive stairs.
* **Offline & Solo Mode**: Play or prepare sessions 100% offline, saving and loading your campaign state in JSON files with a single click.

### 💻 How to Run the Project Locally

1. **Installation & Startup**:
   ```bash
   npm install
   npm run dev
   ```
   Open the generated link (usually `http://localhost:5173`) in your browser.

2. **Running the AI Map Builder (MCP Server)**:
   ```bash
   node mcp-server.js
   ```
   Configure the MCP server in your AI client (such as Cursor or Claude Desktop) pointing to the `mcp-server.js` file.

---

## 🛠️ Tecnologias / Technologies
* **Svelte 5** (Runes)
* **Three.js & Threlte**
* **Vite**
* **PeerJS / WebRTC**
* **WebSockets & MCP**
