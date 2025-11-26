// x402-base.ts
import "dotenv/config";
import { createWalletClient, createPublicClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import fs from "fs";
import crypto from "crypto";

// Configuration
const PRIVATE_KEY_PATH = "./private-key.txt";

// Network configurations
const NETWORKS = {
    "base-sepolia": {
        chain: baseSepolia,
        usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
        apiUrl: "http://localhost:3000/base-sepolia-usdc",
        explorer: "https://sepolia.basescan.org/tx",
    },
    "base": {
        chain: base,
        usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        apiUrl: "http://localhost:3000/base-mainnet-usdc",
        explorer: "https://basescan.org/tx",
    },
} as const;

type NetworkType = keyof typeof NETWORKS;

// Get network from command line args or default to base-sepolia
const NETWORK: NetworkType = (process.argv[2] as NetworkType) || "base-sepolia";

if (!NETWORKS[NETWORK]) {
    console.error(`❌ Invalid network: ${NETWORK}`);
    console.error(`   Valid networks: ${Object.keys(NETWORKS).join(", ")}`);
    process.exit(1);
}

const config = NETWORKS[NETWORK];

function getOrCreatePrivateKey(): `0x${string}` {
    if (fs.existsSync(PRIVATE_KEY_PATH)) {
        console.log("Loading existing private key...");
        let key = fs.readFileSync(PRIVATE_KEY_PATH, "utf-8").trim();
        if (!key.startsWith("0x")) {
            key = `0x${key}`;
        }
        return key as `0x${string}`;
    }

    console.log("Creating new private key...");
    const privateKey = `0x${crypto.randomBytes(32).toString("hex")}` as `0x${string}`;
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
    console.log("Private key saved to:", PRIVATE_KEY_PATH);
    return privateKey;
}

async function checkBalance(address: `0x${string}`) {
    console.log("\n========== BALANCE CHECK ==========");
    console.log("Wallet:", address);
    console.log("Network:", NETWORK);
    console.log("Chain ID:", config.chain.id);
    console.log();

    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(),
    });

    const ethBalance = await publicClient.getBalance({ address });
    console.log("ETH Balance:", formatUnits(ethBalance, 18), "ETH");

    const usdcBalance = await publicClient.readContract({
        address: config.usdc,
        abi: [
            {
                name: "balanceOf",
                type: "function",
                inputs: [{ name: "account", type: "address" }],
                outputs: [{ type: "uint256" }],
            },
        ],
        functionName: "balanceOf",
        args: [address],
    });

    // usdcBalance is type 'unknown', so cast to bigint for formatting and toString calls
    const usdcBalanceBigInt = usdcBalance as bigint;

    console.log("USDC Balance:", formatUnits(usdcBalanceBigInt, 6), "USDC");
    console.log("USDC Raw:", usdcBalanceBigInt.toString());

    console.log("\n--- Requirements ---");
    console.log("Payment amount needed: 1000 (0.001 USDC)");

    let hasEnoughUsdc = false;
    let hasEth = false;

    if (usdcBalanceBigInt >= 1000n) {
        console.log("✅ Sufficient USDC balance");
        hasEnoughUsdc = true;
    } else {
        console.log("❌ Insufficient USDC balance");
        if (NETWORK === "base-sepolia") {
            console.log("   Get USDC from: https://faucet.circle.com/");
        } else {
            console.log("   You need real USDC on Base Mainnet");
        }
    }

    if (ethBalance > 0n) {
        console.log("✅ Has ETH for gas");
        hasEth = true;
    } else {
        console.log("❌ No ETH for gas");
        if (NETWORK === "base-sepolia") {
            console.log("   Get ETH from: https://www.alchemy.com/faucets/base-sepolia");
        } else {
            console.log("   You need real ETH on Base Mainnet");
        }
    }

    console.log("====================================\n");

    return { hasEnoughUsdc, hasEth, usdcBalance, ethBalance };
}

async function main() {
    console.log("🔷 x402 Payment Client");
    console.log(`🌐 Network: ${NETWORK}`);
    console.log(`📍 API URL: ${config.apiUrl}\n`);

    const privateKey = getOrCreatePrivateKey();
    const account = privateKeyToAccount(privateKey);

    console.log("Wallet address:", account.address);

    const { hasEnoughUsdc, hasEth } = await checkBalance(account.address);

    if (!hasEnoughUsdc || !hasEth) {
        console.log("⚠️  Please fund your wallet before proceeding.");
        if (NETWORK === "base") {
            console.log("⚠️  WARNING: This is MAINNET - real funds will be used!");
            const readline = await import("readline");
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const answer = await new Promise<string>((resolve) => {
                rl.question("Continue anyway? (yes/no): ", resolve);
            });
            rl.close();

            if (answer.toLowerCase() !== "yes") {
                console.log("Aborted.");
                process.exit(0);
            }
        }
        console.log("   Continuing anyway...\n");
    }

    const walletClient = createWalletClient({
        account,
        chain: config.chain,
        transport: http(),
    });

    console.log("1. Making initial request to:", config.apiUrl);

    let initialResponse: Response;
    try {
        initialResponse = await fetch(config.apiUrl);
    } catch (err) {
        console.error("❌ Failed to connect to server. Is it running?");
        console.error(err);
        return;
    }

    console.log("Response status:", initialResponse.status);

    const contentType = initialResponse.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
        console.error("❌ Server returned non-JSON response:");
        console.error("Content-Type:", contentType);
        console.error("Body:", await initialResponse.text());
        return;
    }

    if (initialResponse.status !== 402) {
        console.log("✅ No payment required, got response:");
        console.log(await initialResponse.json());
        return;
    }

    const paymentRequirements = await initialResponse.json();
    console.log("Got 402 - Payment Required");
    console.log("Payment requirements:", JSON.stringify(paymentRequirements, null, 2));

    const requirement = paymentRequirements.accepts[0];
    const { payTo, maxAmountRequired, asset, extra, network: paymentNetwork } = requirement;

    console.log("\n2. Creating payment signature...");
    console.log("   Network:", paymentNetwork);
    console.log("   Amount:", maxAmountRequired, "(micro USDC =", Number(maxAmountRequired) / 1_000_000, "USDC)");
    console.log("   Pay to:", payTo);
    console.log("   Asset:", asset);

    const validAfter = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = `0x${crypto.randomBytes(32).toString("hex")}` as `0x${string}`;

    const domain = {
        name: extra?.name || "USDC",
        version: extra?.version || "2",
        chainId: config.chain.id,
        verifyingContract: asset as `0x${string}`,
    };

    const types = {
        TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
        ],
    };

    const message = {
        from: account.address,
        to: payTo as `0x${string}`,
        value: BigInt(maxAmountRequired),
        validAfter,
        validBefore,
        nonce,
    };

    console.log("\n   Signing EIP-712 message...");
    console.log("   Domain:", JSON.stringify(domain, null, 2));

    const signature = await walletClient.signTypedData({
        domain,
        types,
        primaryType: "TransferWithAuthorization",
        message,
    });

    console.log("   ✅ Signature:", signature.slice(0, 30) + "...");

    // Use the network from the payment requirements
    const paymentPayload = {
        x402Version: 1,
        scheme: "exact",
        network: paymentNetwork,
        payload: {
            signature,
            authorization: {
                from: account.address,
                to: payTo,
                value: maxAmountRequired,
                validAfter: validAfter.toString(),
                validBefore: validBefore.toString(),
                nonce,
            },
        },
    };

    console.log("\n   Payment payload:", JSON.stringify(paymentPayload, null, 2));

    const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

    console.log("\n3. Making paid request...");
    const paidResponse = await fetch(config.apiUrl, {
        method: "GET",
        headers: {
            "X-PAYMENT": xPaymentHeader,
        },
    });

    console.log("\n========== RESPONSE ==========");
    console.log("Status:", paidResponse.status, paidResponse.statusText);

    console.log("\nHeaders:");
    paidResponse.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
    });

    const paymentResponseHeader = paidResponse.headers.get("X-PAYMENT-RESPONSE");
    if (paymentResponseHeader) {
        try {
            const decoded = JSON.parse(Buffer.from(paymentResponseHeader, "base64").toString());
            console.log("\nX-PAYMENT-RESPONSE:", JSON.stringify(decoded, null, 2));

            if (decoded.transaction) {
                console.log(`\n📜 View transaction: ${config.explorer}/${decoded.transaction}`);
            }
        } catch (e) {
            console.log("\nX-PAYMENT-RESPONSE (raw):", paymentResponseHeader);
        }
    }

    const bodyText = await paidResponse.text();

    try {
        const body = JSON.parse(bodyText);
        console.log("\nBody:", JSON.stringify(body, null, 2));

        if (paidResponse.status === 200) {
            console.log("\n✅ SUCCESS! Payment accepted!");
            console.log("🎉 You got the premium content!");
        } else if (body.error) {
            console.log("\n❌ ERROR:", JSON.stringify(body.error));
        }
    } catch (e) {
        console.log("\nBody (raw):", bodyText);
    }
}

main().catch(console.error);