const express = require("express");
const { ethers } = require("ethers");
const { OpenSeaSDK, Chain } = require("opensea-js");
require('dotenv').config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3001;

// Add middleware to parse JSON bodies
app.use(express.json());

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  console.log("Request headers:", req.headers);
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.ENDPOINT_SECRET}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized - Invalid or missing authentication"
    });
  }
  
  next();
};

// Chain to RPC provider mapping
const chainToRpcUrl = {
  Ethereum: "https://eth-mainnet.g.alchemy.com/v2/",
  Base: "https://base-mainnet.g.alchemy.com/v2/", 
  Zora: "https://zora-mainnet.g.alchemy.com/v2/",
  Shape: "https://shape-mainnet.g.alchemy.com/v2/"
};

// Example POST request:
/*
curl -X POST http://localhost:3001/make-offer \
-H "Content-Type: application/json" \
-H "Authorization: YOUR_ENDPOINT_SECRET" \
-d '{
  "chain": "Base",
  "tokenAddress": "0x123abc...", 
  "tokenId": "1234",
  "amount": "0.1"
}'
*/

app.post("/make-offer", authenticateRequest, async (req, res) => {
  const { chain, tokenAddress, tokenId, amount } = req.body;

  if (!chain || !tokenAddress || !tokenId || !amount) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters: chain, tokenAddress, tokenId, and amount are required"
    });
  }

  const rpcUrl = chainToRpcUrl[chain];
  if (!rpcUrl) {
    return res.status(400).json({
      success: false,
      error: "Invalid chain specified"
    });
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl + process.env.ALCHEMY_ID);
  const walletWithProvider = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  try {
    const openseaSDK = new OpenSeaSDK(walletWithProvider, {
      chain: Chain[chain],
      apiKey: process.env.OPENSEA_API_KEY,
    });

    const accountAddress = process.env.ARTTO_WALLET_ADDRESS;

    const offer = await openseaSDK.createOffer({
      asset: {
        tokenId,
        tokenAddress,
      },
      accountAddress,
      startAmount: amount,
    });

    // Convert BigInt values to strings in the offer object
    const serializableOffer = JSON.parse(JSON.stringify(offer, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return res.json({
      success: true,
      offer: serializableOffer
    });

  } catch (error) {
    console.error("Error creating offer:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const server = app.listen(port, () => console.log(`Artto OpenSea API Handler listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
