const express = require("express");
const { ethers } = require("ethers");
const { OpenSeaSDK, Chain } = require("opensea-js");
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3001;

// Add middleware to parse JSON bodies
app.use(express.json());

// Authentication middleware
const authenticateRequest = (req, res, next) => {
  console.log("Request headers:", req.headers);
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.OPENSEA_ARTTO_SERVER_BEARER_TOKEN}`;
  
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

app.post("/fund-openrouter", authenticateRequest, async (req, res) => {
  const { amount_usd } = req.body;

  if (!amount_usd || isNaN(amount_usd) || amount_usd <= 0 || amount_usd > 2000) {
    return res.status(400).json({
      success: false,
      error: "Invalid amount_usd. Must be a number between 0 and 2000."
    });
  }

  try {
    // Step 1: Create a new charge
    const chargeData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'openrouter.ai',
        path: '/api/v1/credits/coinbase',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Failed to create charge: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(JSON.stringify({
        amount: amount_usd,
        sender: process.env.ARTTO_WALLET_ADDRESS,
        chain_id: 8453 // Base chain ID
      }));
      req.end();
    });

    console.log("chargeData", chargeData.data);

    const metadata = chargeData.data.web3_data.transfer_intent.metadata;
    const call_data = chargeData.data.web3_data.transfer_intent.call_data;

    const contract_address = metadata.contract_address;

    const poolFeesTier = 500; // Lowest fee tier

    // Step 3: Set up provider and signer
    const provider = new ethers.JsonRpcProvider(chainToRpcUrl.Base + process.env.ALCHEMY_ID);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Step 4: Create contract instance
    const abi = [
      "function swapAndTransferUniswapV3Native(tuple(uint256 recipientAmount, uint256 deadline, address payable recipient, address recipientCurrency, address refundDestination, uint256 feeAmount, bytes16 id, address operator, bytes signature, bytes prefix) _intent, uint24 poolFeesTier) payable"
    ];
    const contract = new ethers.Contract(contract_address, abi, signer);

    // Step 5: Prepare transaction parameters
    const intent = {
      recipientAmount: call_data.recipient_amount,
      deadline: Math.floor(new Date(call_data.deadline).getTime() / 1000),
      recipient: call_data.recipient,
      recipientCurrency: call_data.recipient_currency,
      refundDestination: call_data.refund_destination,
      feeAmount: call_data.fee_amount,
      id: call_data.id,
      operator: call_data.operator,
      signature: call_data.signature,
      prefix: call_data.prefix,
    };

    // Step 6: Estimate gas and get current gas price
    const gasEstimate = await contract.swapAndTransferUniswapV3Native.estimateGas(intent, poolFeesTier, { value: ethers.parseEther("0.004") });
    const gasPrice = ((await provider.getFeeData()).gasPrice)

    // Step 7: Send the transaction
    const tx = await contract.swapAndTransferUniswapV3Native(intent, poolFeesTier, {
      value: ethers.parseEther("0.004"),
      gasLimit: gasEstimate,
      gasPrice: gasPrice
    });

    // Step 8: Wait for the transaction to be mined
    const receipt = await tx.wait();

    return res.json({
      success: true,
      message: "OpenRouter wallet funded successfully",
      transactionHash: receipt.transactionHash
    });

  } catch (error) {
    console.error("Error funding OpenRouter wallet:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const server = app.listen(port, () => console.log(`Artto OpenSea API Handler listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
