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

// Chain to WETH contract address mapping
const chainToWethAddress = {
  Ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  Base: "0x4200000000000000000000000000000000000006",
  Zora: "0x4200000000000000000000000000000006",
  Shape: "0x4200000000000000000000000000000006"
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

app.post("/sell-nft", authenticateRequest, async (req, res) => {
  const { chain, tokenAddress, tokenId, startAmount } = req.body;

  if (!chain || !tokenAddress || !tokenId || !startAmount) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters: chain, tokenAddress, tokenId, and startAmount are required"
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

    // Expire this sale thirty days from now.
    const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24 * 30);

    const listing = await openseaSDK.createListing({
      asset: {
        tokenId,
        tokenAddress,
      },
      accountAddress,
      startAmount,
      expirationTime,
    });

    // Convert BigInt values to strings in the listing object
    const serializableListing = JSON.parse(JSON.stringify(listing, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return res.json({
      success: true,
      listing: serializableListing
    });

  } catch (error) {
    console.error("Error creating listing:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// New endpoint for creating NFT auctions
app.post("/create-auction", authenticateRequest, async (req, res) => {
  const { chain, tokenAddress, tokenId, startAmount } = req.body;

  if (!chain || !tokenAddress || !tokenId || startAmount === undefined) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters: chain, tokenAddress, tokenId, and startAmount are required"
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

    // Expire this auction thirty days from now.
    const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24 * 30);

    // Create an auction to receive Wrapped Ether (WETH)
    const paymentTokenAddress = chainToWethAddress[chain];
    const englishAuction = true;

    const auction = await openseaSDK.createListing({
      asset: {
        tokenId,
        tokenAddress,
      },
      accountAddress,
      startAmount,
      expirationTime,
      paymentTokenAddress,
      englishAuction,
    });

    // Convert BigInt values to strings in the auction object
    const serializableAuction = JSON.parse(JSON.stringify(auction, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return res.json({
      success: true,
      auction: serializableAuction
    });

  } catch (error) {
    console.error("Error creating auction:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const server = app.listen(port, () => console.log(`Artto OpenSea API Handler listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
