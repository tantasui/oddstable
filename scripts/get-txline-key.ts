#!/usr/bin/env bun
/**
 * One-time script: acquire a TxLINE devnet API token.
 *
 * Run from the scripts/ directory:
 *   bun install
 *   bun get-txline-key.ts
 *
 * Writes TXLINE_JWT, TXLINE_API_TOKEN, TXLINE_ORIGIN to apps/server/.env
 * Saves the generated Solana keypair to scripts/txline-wallet.json (keep it!)
 */
import * as anchor from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotent,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import nacl from 'tweetnacl';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

// ── Config ──────────────────────────────────────────────────────────────────
const DEVNET_RPC   = 'https://api.devnet.solana.com';
const API_ORIGIN   = 'https://txline-dev.txodds.com';
const PROGRAM_ID   = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
const TXL_MINT     = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
const SERVICE_LEVEL = 1;   // free tier — 60-second delayed data
const DURATION_WEEKS = 4;
const LEAGUES: string[] = [];   // empty = all available leagues

const KEYPAIR_PATH = join(import.meta.dir, 'txline-wallet.json');
const ENV_PATH     = join(import.meta.dir, '../apps/server/.env');

// ── 1. Wallet ────────────────────────────────────────────────────────────────
let keypair: Keypair;
if (existsSync(KEYPAIR_PATH)) {
  const raw = JSON.parse(readFileSync(KEYPAIR_PATH, 'utf8')) as number[];
  keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  console.log('[wallet] loaded existing keypair:', keypair.publicKey.toBase58());
} else {
  keypair = Keypair.generate();
  writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(keypair.secretKey)));
  console.log('[wallet] generated new keypair:', keypair.publicKey.toBase58());
  console.log('[wallet] saved to', KEYPAIR_PATH, '— back this file up!');
}

// ── 2. Provider ───────────────────────────────────────────────────────────────
const connection = new Connection(DEVNET_RPC, 'confirmed');
const wallet     = new anchor.Wallet(keypair);
const provider   = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
anchor.setProvider(provider);

// ── 3. Fund wallet with devnet SOL ────────────────────────────────────────────
async function getBalance() {
  return connection.getBalance(keypair.publicKey);
}

let lamports = await getBalance();
console.log('[sol] balance:', (lamports / LAMPORTS_PER_SOL).toFixed(4), 'SOL');

if (lamports < 0.05 * LAMPORTS_PER_SOL) {
  // Try built-in airdrop first
  let airdropped = false;
  try {
    console.log('[sol] requesting 2 SOL airdrop via devnet RPC...');
    const sig = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ signature: sig, ...(await connection.getLatestBlockhash()) });
    airdropped = true;
    console.log('[sol] airdrop confirmed');
  } catch {
    console.log('[sol] RPC airdrop rate-limited or failed.');
  }

  if (!airdropped) {
    console.log('\n┌─────────────────────────────────────────────────────────────┐');
    console.log('│  Fund your devnet wallet with ~0.1 SOL before continuing.   │');
    console.log('│                                                               │');
    console.log('│  Wallet address:                                              │');
    console.log('│  ' + keypair.publicKey.toBase58().padEnd(61) + '│');
    console.log('│                                                               │');
    console.log('│  Options:                                                     │');
    console.log('│  • https://faucet.solana.com  (paste address, select Devnet) │');
    console.log('│  • https://solfaucet.com                                      │');
    console.log('│                                                               │');
    console.log('│  Press Enter once funded...                                   │');
    console.log('└─────────────────────────────────────────────────────────────┘\n');

    // Wait for user to press Enter, then poll balance
    process.stdout.write('> ');
    await new Promise<void>((resolve) => {
      const rl = createInterface({ input: process.stdin });
      rl.once('line', () => { rl.close(); resolve(); });
    });

    // Poll until funded
    for (let i = 0; i < 30; i++) {
      lamports = await getBalance();
      if (lamports >= 0.05 * LAMPORTS_PER_SOL) {
        console.log('[sol] balance confirmed:', (lamports / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
        break;
      }
      console.log('[sol] balance still 0, waiting 5s...');
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (lamports < 0.05 * LAMPORTS_PER_SOL) {
      throw new Error('Wallet still has no SOL after waiting. Please fund it and re-run.');
    }
  }
}

// ── 4. Fetch IDL + build program ──────────────────────────────────────────────
console.log('[anchor] fetching IDL from chain (may take a few seconds)...');
const idl = await anchor.Program.fetchIdl(PROGRAM_ID, provider);
if (!idl) throw new Error('IDL not found on-chain for program ' + PROGRAM_ID.toBase58());
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const program = new anchor.Program(idl as any, provider);

// ── 5. Derive PDAs ────────────────────────────────────────────────────────────
const [treasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('token_treasury_v2')],
  PROGRAM_ID,
);
const treasuryVault = getAssociatedTokenAddressSync(
  TXL_MINT, treasuryPda, true,
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
);
const [pricingMatrix] = PublicKey.findProgramAddressSync(
  [Buffer.from('pricing_matrix')],
  PROGRAM_ID,
);
const userTokenAccount = getAssociatedTokenAddressSync(
  TXL_MINT, keypair.publicKey, false,
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
);

// ── 6. Guest JWT ──────────────────────────────────────────────────────────────
// Accept-Encoding: gzip avoids zstd which Bun's fetch can't decompress.
const BASE_HEADERS = { 'Accept-Encoding': 'gzip', 'Content-Type': 'application/json' };

console.log('[txline] requesting guest JWT...');
const authRes = await fetch(`${API_ORIGIN}/auth/guest/start`, {
  method: 'POST',
  headers: BASE_HEADERS,
});
if (!authRes.ok) throw new Error(`/auth/guest/start → ${authRes.status}: ${await authRes.text()}`);
const { token: jwt } = await authRes.json() as { token: string };
console.log('[txline] JWT obtained');

// ── 7. Create TxL token ATA (required before subscribe, even for free tier) ────
// subscribe errors with AccountNotInitialized if the ATA doesn't exist yet.
console.log('[txl-ata] initializing token account...');
await createAssociatedTokenAccountIdempotent(
  connection,
  keypair,              // payer
  TXL_MINT,
  keypair.publicKey,
  { commitment: 'confirmed' },
  TOKEN_2022_PROGRAM_ID,
);
console.log('[txl-ata] ready:', userTokenAccount.toBase58());

// ── 8. On-chain subscription ───────────────────────────────────────────────────
console.log(`[onchain] subscribing — service level ${SERVICE_LEVEL}, ${DURATION_WEEKS} weeks...`);
const txSig = await (program.methods as any)
  .subscribe(SERVICE_LEVEL, DURATION_WEEKS)
  .accounts({
    user: keypair.publicKey,
    pricingMatrix,
    tokenMint: TXL_MINT,
    userTokenAccount,
    tokenTreasuryVault: treasuryVault,
    tokenTreasuryPda: treasuryPda,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .rpc() as string;
console.log('[onchain] subscription tx:', txSig);

// ── 9. Sign activation message ────────────────────────────────────────────────
const messageStr   = `${txSig}:${LEAGUES.join(',')}:${jwt}`;
const messageBytes = new TextEncoder().encode(messageStr);
const sigBytes     = nacl.sign.detached(messageBytes, keypair.secretKey);
const walletSignature = Buffer.from(sigBytes).toString('base64');

// ── 10. Activate API token ────────────────────────────────────────────────────
console.log('[txline] activating API token...');
const activateRes = await fetch(`${API_ORIGIN}/api/token/activate`, {
  method: 'POST',
  headers: { ...BASE_HEADERS, Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ txSig, walletSignature, leagues: LEAGUES }),
});
const activateText = await activateRes.text();
if (!activateRes.ok) {
  throw new Error(`/api/token/activate → ${activateRes.status}: ${activateText}`);
}
console.log('[txline] activate raw response:', activateText.slice(0, 200));

let apiToken: string;
try {
  const parsed = JSON.parse(activateText) as string | { token: string };
  apiToken = typeof parsed === 'string' ? parsed : parsed.token;
} catch {
  // Response is a bare token string, not JSON
  apiToken = activateText.trim();
}
console.log('[txline] API token acquired!');

// ── 11. Write to apps/server/.env ─────────────────────────────────────────────
const KEYS_TO_STRIP = ['TXLINE_JWT', 'TXLINE_API_TOKEN', 'TXLINE_ORIGIN'];
let existing = '';
if (existsSync(ENV_PATH)) {
  existing = readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .filter((l) => !KEYS_TO_STRIP.some((k) => l.startsWith(`${k}=`)))
    .join('\n')
    .trim();
  if (existing) existing += '\n';
}
const newEnv = `${existing}TXLINE_JWT=${jwt}\nTXLINE_API_TOKEN=${apiToken}\nTXLINE_ORIGIN=${API_ORIGIN}\n`;
writeFileSync(ENV_PATH, newEnv);

console.log('\n✓ Done! Written to apps/server/.env:');
console.log('  TXLINE_JWT=<jwt>');
console.log('  TXLINE_API_TOKEN=<token>');
console.log('  TXLINE_ORIGIN=', API_ORIGIN);
console.log('\nWallet pubkey:', keypair.publicKey.toBase58());
console.log('Keep scripts/txline-wallet.json safe — you need it to renew the subscription.');
