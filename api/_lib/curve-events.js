const { PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

const TOKEN_DECIMALS = 9;
const TOKEN_SCALE = 10 ** TOKEN_DECIMALS;

const CURVE_BUY_V2_DISCRIMINATOR = [223, 218, 65, 67, 253, 124, 178, 156];
const CURVE_SELL_V2_DISCRIMINATOR = [9, 22, 19, 150, 232, 92, 244, 40];

const sameDiscriminator = (data, disc) =>
  data.length >= disc.length && disc.every((byte, index) => data[index] === byte);

const readPubkey = (data, offset) => new PublicKey(data.subarray(offset, offset + 32)).toBase58();
const readU64 = (data, offset) => Number(data.readBigUInt64LE(offset));
const readI64 = (data, offset) => Number(data.readBigInt64LE(offset));

function parseCurveTradeEventData(data) {
  if (sameDiscriminator(data, CURVE_BUY_V2_DISCRIMINATOR)) {
    let offset = 8;
    const mint = readPubkey(data, offset); offset += 32;
    const trader = readPubkey(data, offset); offset += 32;
    const solInLamports = readU64(data, offset); offset += 8;
    offset += 8; // platform_fee_lamports
    offset += 8; // creator_fee_lamports
    const tokensOut = readU64(data, offset); offset += 8;
    const priceLamportsPerToken = readU64(data, offset); offset += 8;
    const timestamp = readI64(data, offset);

    return {
      mint,
      trader,
      side: "buy",
      source: "curve",
      token_amount: tokensOut / TOKEN_SCALE,
      sol_amount: solInLamports / LAMPORTS_PER_SOL,
      price_sol: priceLamportsPerToken / LAMPORTS_PER_SOL,
      block_time: new Date(timestamp * 1000).toISOString(),
    };
  }

  if (sameDiscriminator(data, CURVE_SELL_V2_DISCRIMINATOR)) {
    let offset = 8;
    const mint = readPubkey(data, offset); offset += 32;
    const trader = readPubkey(data, offset); offset += 32;
    const tokensIn = readU64(data, offset); offset += 8;
    const grossSolOutLamports = readU64(data, offset); offset += 8;
    offset += 8; // platform_fee_lamports
    offset += 8; // creator_fee_lamports
    offset += 8; // seller_receives_lamports
    const priceLamportsPerToken = readU64(data, offset); offset += 8;
    const timestamp = readI64(data, offset);

    return {
      mint,
      trader,
      side: "sell",
      source: "curve",
      token_amount: tokensIn / TOKEN_SCALE,
      sol_amount: grossSolOutLamports / LAMPORTS_PER_SOL,
      price_sol: priceLamportsPerToken / LAMPORTS_PER_SOL,
      block_time: new Date(timestamp * 1000).toISOString(),
    };
  }

  return null;
}

function parseCurveTradeEvents(logMessages = [], expectedMint) {
  const events = [];
  for (const log of logMessages || []) {
    const match = /^Program data: (.+)$/.exec(log);
    if (!match) continue;
    try {
      const event = parseCurveTradeEventData(Buffer.from(match[1], "base64"));
      if (event && (!expectedMint || event.mint === expectedMint)) events.push(event);
    } catch (error) {
      console.warn("[curve-events] failed to parse event log", error.message);
    }
  }
  return events;
}

module.exports = { parseCurveTradeEvents };
