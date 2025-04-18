# 🏛️ LandChain

> A decentralized land record management system built on the Polygon blockchain, integrating encrypted document storage, NFT-based ownership, INR tokenization, and UPI/card payments.

---

## 🚀 Overview

**LandChain** is transforming how land records are stored, updated, and transferred by leveraging blockchain, encryption, and digital payments. Our platform ensures **secure**, **transparent**, and **tamper-proof** land ownership through NFTs, while enabling seamless INR-based transactions through UPI/card payments.

---

## 🔗 Live Contracts

- **Polygon Amoy (Testnet)**  
  - NFT Contract: [`0xYourContractAddress`](#)  
  - Token Contract: [`0xYourINRTokenAddress`](#)  
  - Proxy (Coming Soon)

> ⚠️ All smart contracts are upgradeable and adhere to OpenZeppelin UUPS proxies.

---

## 📦 Tech Stack

| Layer        | Tech/Tools                                         |
|--------------|----------------------------------------------------|
| Blockchain   | Polygon zkEVM / Polygon PoS                        |
| Smart Contracts | Solidity, Hardhat, OpenZeppelin (Upgradeable)     |
| Backend      | Node.js / Express (API Gateway + DB encryption)    |
| Frontend     | React + TailwindCSS (ThirdWeb & ethers.js)         |
| Payments     | RazorPay (INR Tokenization + UPI/Card Gateway)     |
| Storage      | IPFS + AES-256 Encryption                          |
| Identity     | Aadhaar (UIDAI-verified via KYC partners)          |

---

## 🧩 Core Features

- ✅ **NFT Minting for Land Records** (with encrypted metadata)
- 🔄 **Append-Only Updates** using update history (not overwrite)
- 🔐 **AES Encrypted Document Upload** (PDF, PPT, MP4, TXT, IMG)
- 🧾 **Audit Logging** of every state change (fully on-chain)
- 🪙 **Tokenized INR Payments** via RazorPay (non-official INR token)
- 👤 **Aadhaar Verification** (for Indian identity verification)
- 🧑‍⚖️ **Government Permission Layer** (admin tools for officials)
- 📱 **Mobile-First & AppStore-Ready DApp**

---

## 🧪 Testing

1. Clone this repo:
    ```bash
    git clone https://github.com/your-org/landchain.git
    cd landchain
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Compile and test contracts:
    ```bash
    npx hardhat compile
    npx hardhat test
    ```

---

## ⚙️ Deployment

### 🔹 To Deploy on Polygon Mainnet:

1. Set up `.env`:
    ```env
    PRIVATE_KEY=your_wallet_private_key
    POLYGON_RPC=https://polygon-rpc.com
    ```

2. Run:
    ```bash
    npx hardhat run scripts/deploy.js --network polygon
    ```

---

## 💰 Payments & Tokenization

- Users pay ₹300 INR to mint a land NFT.
- Payments are processed via RazorPay (card/UPI).
- The platform mints equivalent INR tokens internally for on-chain use.
- Token transfers reflect real-world currency transactions securely.

---

## 📅 Roadmap

| Phase | Milestone |
|-------|-----------|
| ✅ Phase 1 | NFT Smart Contract + Encryption Logic |
| 🔄 Phase 2 | DApp Integration + Logging + Upgradable Contracts |
| 🟩 Phase 3 | INR Payments + Aadhaar Verification |
| 🟨 Phase 4 | Government Portal & Production Deployment |
| 🟪 Phase 5 | Mobile App Launch (Play Store + App Store) |

---

## 🎯 Goals

- Reduce land disputes by 90% via immutability and clear ownership.
- Enable state-level governments to integrate blockchain with ease.
- Bring real-world assets into the on-chain economy through NFT ownership.

---

## 🧠 Credits

- **Team LandChain**
- Mentors from Inventure Changemaker Challenge 2024
- Built with ❤️ on Polygon

---

## 🌐 Visit Us

📎 Website: [https://landchain.in](https://landchain.in)  
🛠️ GitHub: [github.com/your-org/landchain](https://github.com/your-org/landchain)

