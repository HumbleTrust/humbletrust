## Hi there 👋# 🔷 HumbleTrust — Solana Token Launch Platform

HumbleTrust is a next‑generation Solana token launch platform with features that go far beyond standard SPL token creation.  
It includes a fully custom **Anchor smart contract**, a **React/Vite frontend**, and several unique mechanisms that have no direct analogs in other launchpads.

<p align="center">
  <img src="https://img.shields.io/badge/Solana-Web3-purple?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Anchor-Framework-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge" />
</p>

---

## 🚀 Unique Features (No Analogues)

### 🔹 Multi‑Tier Token Logic  
A custom tier system that affects fees, launch parameters, and token behavior.  
This is not available in standard SPL token tools.

### 🔹 On‑Chain Anti‑Bot Protection  
Anti‑bot rules enforced directly inside the Anchor program, not on the frontend.

### 🔹 Advanced Distribution System  
Creator allocation, airdrop allocation, burn allocation — all configurable in a single instruction.

### 🔹 Built‑In Vesting  
Lock percentage + lock duration stored on‑chain in PDA accounts.

### 🔹 Fully Custom PDA Configuration  
All token settings are stored in a deterministic PDA, enabling trustless verification.

### 🔹 Modular Architecture  
- Smart contract  
- Frontend  
- Migrations  
- Tests  
All separated cleanly.

### 🔹 Direct IDL‑Driven Frontend  
The UI interacts with the program through AnchorProvider and IDL — no hacks, no wrappers.

---

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/HumbleTrust/humbletrust.git
cd humbletrust
2. Build the Anchor program
bash
anchor build
3. Run the frontend
bash
cd app
npm install
npm run dev
🧪 Tests
bash
anchor test
🛠 Tech Stack
Solana

Anchor

Rust

TypeScript

React

Vite

📁 Project Structure
Code
humbletrust/
│   Anchor.toml
│   Cargo.toml
│   PHASES.md
│   tsconfig.json
│   rust-toolchain.toml
│
├── programs/
│   └── humbletrust/
│       ├── Cargo.toml
│       └── src/lib.rs
│
├── app/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
└── tests/
    └── humbletrust.ts
🌐 Deployment (Frontend)
You can deploy the frontend on Vercel:

Connect your GitHub repository

Set the project root to app/

Build command:

bash
npm run build
Output directory:

bash
dist
🗺 Roadmap
[ ] Add token metadata upload

[ ] Add liquidity pool integration

[ ] Add token locking dashboard

[ ] Add analytics page

[ ] Add program upgrade UI

[ ] Add mobile-friendly layout

🤝 Contributing
Contributions, issues, and feature requests are welcome.
Feel free to open a PR or create an issue.

📄 License
This project is licensed under the MIT License.

👤 Author
HumbleTrust  
Solana Developer
git clone https://github.com/HumbleTrust/humbletrust.git
cd humbletrust
2. Build the Anchor program
bash
anchor build
3. Run the frontend
bash
cd app
npm install
npm run dev
🧪 Tests
bash
anchor test
🛠 Tech Stack
Solana

Anchor

Rust

TypeScript

React

Vite

📁 Project Structure
Code
humbletrust/
│   Anchor.toml
│   Cargo.toml
│   PHASES.md
│   tsconfig.json
│   rust-toolchain.toml
│
├── programs/
│   └── humbletrust/
│       ├── Cargo.toml
│       └── src/lib.rs
│
├── app/
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
└── tests/
    └── humbletrust.ts
🌐 Deployment (Frontend)
You can deploy the frontend on Vercel:

Connect your GitHub repository

Set the project root to app/

Build command:

bash
npm run build
Output directory:

bash
dist
🗺 Roadmap
[ ] Add token metadata upload

[ ] Add liquidity pool integration

[ ] Add token locking dashboard

[ ] Add analytics page

[ ] Add program upgrade UI

[ ] Add mobile-friendly layout

🤝 Contributing
Contributions, issues, and feature requests are welcome.
Feel free to open a PR or create an issue.

📄 License
This project is licensed under the MIT License.

👤 Author
HumbleTrust  
Solana Developer
