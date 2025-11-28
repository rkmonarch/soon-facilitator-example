import express from "express";
import { paymentMiddleware } from "x402-express";
import compression from "compression";
import cors from "cors";
import process from "process";
import { FacilitatorNetwork } from "./config";

const app = express();

// IMPORTANT: These must come FIRST
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setTimeout(10000);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", endpoints: ["/base-sepolia", "/base-sepolia-usdc"] });
});

// Configure payment middleware for /base-sepolia
app.use(
  paymentMiddleware(
    "0x75c3c41f7d6504bb843a2b5ebbc62603901d2052",
    {
      "/base-sepolia": {
        price: "$0.0002",
        network: FacilitatorNetwork.BASE_SEPOLIA,
        config: {
          description: "Access to premium content",
        },
      },
    },
    {
      url: "https://facilitator.soo.network",
    }
  )
);

// Configure payment middleware for /base-sepolia-usdc
app.use(
  paymentMiddleware(
    "0x75c3c41f7d6504bb843a2b5ebbc62603901d2052",
    {
      "/base-sepolia-usdc": {
        price: {
          amount: "1000",
          asset: {
            address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            decimals: 6,
            eip712: {
              name: "USDC",
              version: "2",
            },
          },
        },
        network: "base-sepolia",
        config: {
          description: "Access to premium content",
        },
      },
    },
    // base mainnet
    {
      "/base-mainnet-usdc": {
        price: {
          amount: "1000",
          asset: {
            address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            decimals: 6,
            eip712: {
              name: "USDC",
              version: "2",
            },
          },
        },
        network: "base-sepolia",
        config: {
          description: "Access to premium content",
        },
      },
    },
    {
      url: "https://facilitator.soo.network",
    }
  )
);

// Routes
app.get("/base-sepolia", (req, res) => {
  res.json({ message: "This content is behind a paywall (base-sepolia)" });
});

app.get("/base-mainnet-usdc", (req, res) => {
  res.json({ message: "This content is behind a paywall (base-mainnet-usdc)" });
});

app.get("/base-sepolia-usdc", (req, res) => {
  res.json({ message: "This content is behind a paywall (base-sepolia-usdc)" });
});

const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   - GET /base-sepolia`);
  console.log(`   - GET /base-sepolia-usdc`);
});

server.setTimeout(15000);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});