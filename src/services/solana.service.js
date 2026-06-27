'use strict';

const { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL, SystemProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createTransferInstruction, getAccount, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const bs58 = require('bs58').default;
const axios = require('axios');
const { logger } = require('../utils/logger');

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PLATFORM_WALLET_PRIVATE_KEY = process.env.PLATFORM_WALLET_PRIVATE_KEY || '';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

const connection = new Connection(SOLANA_RPC, 'confirmed');

function getPlatformKeypair() {
  if (!PLATFORM_WALLET_PRIVATE_KEY) throw new Error('PLATFORM_WALLET_PRIVATE_KEY not set');
  const { Keypair } = require('@solana/web3.js');
  const secret = bs58.decode(PLATFORM_WALLET_PRIVATE_KEY);
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function getPlatformUsdcATA() {
  const platform = getPlatformKeypair();
  return getAssociatedTokenAddress(USDC_MINT, platform.publicKey);
}

async function getTokenBalance(walletAddress, mintAddress) {
  try {
    const pubkey = new PublicKey(walletAddress);
    const ata = await getAssociatedTokenAddress(new PublicKey(mintAddress), pubkey);
    const account = await getAccount(connection, ata);
    return Number(account.amount);
  } catch {
    return 0;
  }
}

async function getSolBalance(walletAddress) {
  try {
    const pubkey = new PublicKey(walletAddress);
    const bal = await connection.getBalance(pubkey);
    return bal / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

async function getJupiterQuote(inputMint, outputMint, amountLamports, slippageBps = 50) {
  const { data } = await axios.get('https://quote-api.jup.ag/v6/quote', {
    params: { inputMint, outputMint, amount: amountLamports, slippageBps },
  });
  return data;
}

async function getJupiterSwapTx(quoteResponse, userPublicKey) {
  const { data } = await axios.post('https://quote-api.jup.ag/v6/swap', {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
  });
  return data;
}

async function verifyAndCreditDeposit(userId, signedTxBase64, expectedAmountUsdc) {
  const platformAta = await getPlatformUsdcATA();
  const platformAtaStr = platformAta.toString();

  const tx = Transaction.from(Buffer.from(signedTxBase64, 'base64'));

  const expectedLamports = Math.round(expectedAmountUsdc * 1_000_000);

  let foundValidTransfer = false;
  let transferAmount = 0;
  let senderAddress = '';

  for (const ix of tx.instructions) {
    if (!ix.programId.equals(TOKEN_PROGRAM_ID)) continue;

    const data = ix.data;
    if (data.length < 9) continue;
    if (data[0] !== 3) continue;

    const amount = Number(data.readBigUInt64LE(1));

    const destKey = ix.keys[1]?.pubkey?.toString();
    if (destKey !== platformAtaStr) continue;

    foundValidTransfer = true;
    transferAmount = amount;

    senderAddress = ix.keys[0]?.pubkey?.toString() || '';
    break;
  }

  if (!foundValidTransfer) {
    throw new Error('No valid USDC transfer instruction to platform found in transaction');
  }

  if (transferAmount < expectedLamports) {
    throw new Error(
      `Transfer amount (${transferAmount / 1_000_000} USDC) below expected (${expectedAmountUsdc} USDC)`
    );
  }

  const sig = await connection.sendRawTransaction(tx.serialize());
  const confirmation = await connection.confirmTransaction(sig, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }

  logger.info(`x402 deposit confirmed: sig=${sig} user=${userId} amount=${transferAmount / 1_000_000} USDC`);

  return { signature: sig, senderAddress, amount: transferAmount / 1_000_000 };
}

async function sendUsdc(toAddress, amountUsdc) {
  const platform = getPlatformKeypair();
  const platformAta = await getPlatformUsdcATA();
  const recipient = new PublicKey(toAddress);
  const recipientAta = await getAssociatedTokenAddress(USDC_MINT, recipient);

  const tx = new Transaction().add(
    createTransferInstruction(
      platformAta,
      recipientAta,
      platform.publicKey,
      Math.round(amountUsdc * 1_000_000),
    )
  );

  tx.feePayer = platform.publicKey;
  const blockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash.blockhash;
  tx.sign(platform);

  const sig = await connection.sendRawTransaction(tx.serialize());
  const confirmation = await connection.confirmTransaction(sig, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`USDC transfer failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }
  return sig;
}

async function sendSol(toAddress, amountSol) {
  const platform = getPlatformKeypair();
  const recipient = new PublicKey(toAddress);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: platform.publicKey,
      toPubkey: recipient,
      lamports,
    })
  );

  tx.feePayer = platform.publicKey;
  const blockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash.blockhash;
  tx.sign(platform);

  const sig = await connection.sendRawTransaction(tx.serialize());
  const confirmation = await connection.confirmTransaction(sig, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`SOL transfer failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }
  return sig;
}

module.exports = {
  connection,
  USDC_MINT,
  SOL_MINT,
  getPlatformKeypair,
  getPlatformUsdcATA,
  getTokenBalance,
  getSolBalance,
  getJupiterQuote,
  getJupiterSwapTx,
  verifyAndCreditDeposit,
  sendUsdc,
  sendSol,
};
