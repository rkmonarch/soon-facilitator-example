# SOON x402 Facilitator Example

This repository provides an example implementation of an **x402** project that connects a client to a SOON facilitator server for executing on-chain actions.

The **x402 project consists of two parts**:

- **`client/`** — the x402 client application  
- **`server/`** — the x402 facilitator back-end service

This example **currently supports two networks**:

- **Base mainnet**
- **Base sepolia testnet**

---

## 📁 Project Structure

soon-facilitator-example

- client X402 client app (TypeScript)

- server X402 facilitator server (Node.js / TypeScript)


Each part has its own dependencies and build scripts.

---

## 🔧 Prerequisites

- **Node.js 18+**
- **npm**, **yarn**, or **pnpm**

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rkmonarch/soon-facilitator-example.git
cd soon-facilitator-example
```

🖥️ Server (Middleware)

The server lives in the server/ directory and handles interactions with Base and Solana.

2. Install server dependencies
```bash
cd server
pnpm i
```
3. Start the server 
```bash
pnpm run dev
```
The server will start on the port 3000

## 🔷 Client Script (`client/index.ts`)

The `index.ts` script in the `client/` folder is the entry-point for making an x402 payment request from the client side. It handles:

- creating or loading a local wallet  
- checking balances (ETH + USDC)  
- generating an EIP-712 `TransferWithAuthorization` signature  
- sending a paid request to the facilitator server  
- printing transaction details and payment results  

This script currently supports:

- **Base Sepolia testnet** 
- **Base Mainnet**


You can use **either**:

### **1. Auto-generated wallet (default)**  
If `private-key.txt` does not exist, the script will:

- generate a new burner wallet  
- save the private key to `private-key.txt`  
- use that wallet for all requests  

This is recommended for **Base Sepolia testing**.

### **2. Your own wallet (burner recommended)**  
To use your own wallet:

1. Create a file named `private-key.txt`
2. Paste your private key (with or without `0x`)
3. Save the file

⚠️ Only use a **burner wallet** on Base Mainnet — real funds are involved.

---

## ▶️ Run the Client

Inside the `client/` directory:

```bash
pnpm start
```

This runs:

```bash
npx node index.ts
```

By default, it targets Base Sepolia and the payment endpoint:

http://localhost:3000/base-sepolia-usdc

Make sure the server is running before starting the client.

🧪 Example Successful Output

When everything is configured correctly, a successful run will look like this:

```
🔷 x402 Payment Client
🌐 Network: base-sepolia
📍 API URL: http://localhost:3000/base-sepolia-usdc

Loading existing private key...
Wallet address: 0x263a6F5d49F5ed161012Afe6E1eBAC831F1BeAD7

========== BALANCE CHECK ==========
ETH Balance: 0.001 ETH
USDC Balance: 1 USDC
====================================

1. Making initial request...
Got 402 - Payment Required

2. Creating payment signature...
   Network: base-sepolia
   Amount: 1000 (0.001 USDC)
   Pay to: 0x75c3...2052
   Asset: 0x036C...F7e

3. Making paid request...

========== RESPONSE ==========
Status: 200 OK

X-PAYMENT-RESPONSE: {
  "success": true,
  "transaction": "0x2584546ea069...",
  "network": "base-sepolia",
  "payer": "0x263a6F5d49F5..."
}

📜 View transaction:
https://sepolia.basescan.org/tx/0x2584546ea069...

Body: {
  "message": "This content is behind a paywall (base-sepolia-usdc)"
}

✅ SUCCESS! Payment accepted!
🎉 You got the premium content!
```



