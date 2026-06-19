# 🏰 AETHELGARD: SOUL VTT // Virtual Table Top Supreme

**Aethelaard** é uma revolução completa na forma de mestrar e jogar RPG online. Desenvolvido com uma moderna arquitetura em **Svelte 5 (Runes)**, **Vite** e renderização 3D de alta performance com **Three.js / Threlte**, este tabuleiro virtual (VTT) elimina a necessidade de servidores centrais complexos ou assinaturas caras, entregando uma experiência imersiva diretamente no navegador.

---

## 🚀 A Revolução do Tabuleiro de RPG: Construção Dinâmica por Inteligência Artificial (MCP)

Aethelaard traz para o mundo do RPG o **Model Context Protocol (MCP)**, permitindo que você construa, altere e popule seus mapas tridimensionais em tempo real usando apenas **prompts em linguagem natural** através de uma Inteligência Artificial!

Imagine conversar com o seu co-piloto de IA e dizer:
> *"Crie uma masmorra abandonada com quatro salas interconectadas. Adicione portas de madeira nas entradas, coloque alguns baús trancados e barris de suprimentos nos cantos, e spawne três monstros na sala principal."*

A IA lê a lista de assets disponíveis do seu projeto (tokens, modelos 3D, texturas de pedra/madeira) e desenha paredes, portas, pisos, inimigos e detalhes automaticamente no tabuleiro em segundos!

---

## ✨ Recursos de Destaque (Features)

### 🎨 1. Motor 3D de Alta Performance (Three.js & Threlte)
* Visualização imersiva em 3D de alta fidelidade diretamente no browser.
* Suporte a formas geométricas customizadas e importação direta de modelos **3D (.glb / .gltf)**.
* Efeitos de partículas em tempo real controlados pelo GM (explosões espirituais, reações mágicas, relâmpagos).
* Texturização flexível e responsiva com troca rápida de imagens de tokens e cenários.

### 🌐 2. Conectividade Peer-to-Peer Autêntica (PeerJS)
* **Sem servidores intermediários**: conexões diretas WebRTC seguras e de baixíssima latência entre o GM (Host) e os jogadores (Clients).
* Sincronização instantânea de posições, atributos, fichas de personagem e rolagens de dados.
* Sistema inteligente de detecção de colisões para impedir que jogadores atravessem paredes ou andem distâncias não permitidas.

### ⚡ 3. Fichas de Personagem Dinâmicas e Runes do Svelte 5
* Fichas de RPG interativas e integradas com sistema de HP/EP (Energy Points) e habilidades especiais (como o comando *Dash* para movimentação tática).
* Indicadores visuais de estados de combate (como *Stun* e *Death State*).
* Histórico global de log de rolagens e ações executadas no tabuleiro.

### ⛺ 4. Ambientes Multicamadas e Cenários
* Crie múltiplos cenários isolados na mesma sessão (ex: Soul Society, Karakura Town, Hueco Mundo).
* Mude o tema visual, opacidade de mapas de fundo e gerencie múltiplos andares e elevações (SketchUp style) com plataformas elevadas e escadas interativas.

### 🛠️ 5. Modo Offline & Solo
* Jogue ou prepare sessões de forma 100% offline localmente, salvando e carregando o estado de sua campanha em arquivos JSON com apenas um clique.

---

## 💻 Como Rodar o Projeto Localmente

### 1. Pré-requisitos
* Node.js instalado (v18 ou superior recomendado).

### 2. Instalação e Inicialização
Clone o repositório, instale as dependências e inicie o servidor Vite:
```bash
npm install
npm run dev
```
Acesse o link gerado (geralmente `http://localhost:5173`) no seu navegador.

### 3. Executando o Assistente de Construção IA (MCP Server)
Para habilitar a construção de mapas via inteligência artificial:
```bash
node mcp-server.js
```
Configure o servidor MCP em seu cliente de IA (como Cursor ou Claude Desktop) apontando para o arquivo `mcp-server.js`.

---

## 🛠️ Tecnologias Utilizadas
* **Svelte 5** (utilizando o poder dos Runes para reatividade ultrafina)
* **Three.js & Threlte** (renderização gráfica 3D acelerada por hardware)
* **Vite** (bundler de desenvolvimento rápido)
* **PeerJS / WebRTC** (comunicação P2P direta)
* **WebSockets & MCP** (comunicação bidirecional local com a IA de desenvolvimento)

---

Aethelaard redefine os limites do RPG de mesa virtual, unindo o poder da computação gráfica 3D moderna à interatividade ágil da Inteligência Artificial Generativa. Monte sua mesa, conecte seus amigos e crie mundos num piscar de olhos!
