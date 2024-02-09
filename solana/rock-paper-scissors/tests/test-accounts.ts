import { web3 } from "@coral-xyz/anchor";
import {
  ACCOUNT_SIZE,
  AccountLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AddedAccount } from "solana-bankrun";
import { USDC_MINT } from "./rock-paper-scissors";

export const buildLocalTestAta = (
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number
) => {
  const ataBuffer = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      mint,
      owner,
      amount: BigInt(amount),
      delegateOption: 0,
      delegate: web3.PublicKey.default,
      delegatedAmount: BigInt(0),
      state: 1,
      isNativeOption: 0,
      isNative: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: web3.PublicKey.default,
    },
    ataBuffer
  );
  return ataBuffer;
};

export const buildAccounts = async (
  authorityPublicKey: web3.PublicKey,
  firstPlayerPublicKey: web3.PublicKey,
  firstPlayerAta: web3.PublicKey,
  secondPlayerPublicKey: web3.PublicKey,
  secondPlayerAta: web3.PublicKey,
  mainnetConnection: web3.Connection,
  mint: web3.PublicKey = USDC_MINT
): Promise<AddedAccount[]> => [
  // Let's pull mint from mainnet for testing purposes only
  {
    address: mint,
    info: await mainnetConnection.getAccountInfo(mint),
  },
  // Allocate 1 sol to authority for gas and fees
  {
    address: authorityPublicKey,
    info: {
      data: Buffer.alloc(0),
      lamports: 1_000000000,
      owner: web3.SystemProgram.programId,
      executable: false,
    },
  },
  // Allocate 1 sol to first player for gas and fees
  {
    address: firstPlayerPublicKey,
    info: {
      data: Buffer.alloc(0),
      lamports: 1_000000000,
      owner: web3.SystemProgram.programId,
      executable: false,
    },
  },
  // Allocate 1 sol to second player for gas and fees
  {
    address: secondPlayerPublicKey,
    info: {
      data: Buffer.alloc(0),
      lamports: 1_000000000,
      owner: web3.SystemProgram.programId,
      executable: false,
    },
  },
  // Allocate 100 mint (9 decimals) to first player [Printer go brrrr]
  {
    address: firstPlayerAta,
    info: {
      data: buildLocalTestAta(mint, firstPlayerPublicKey, 100_000000000),
      lamports: 1_000000000,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    },
  },
  // Allocate 100 mint (9 decimals) to second player [Printer go brrrr]
  {
    address: secondPlayerAta,
    info: {
      data: buildLocalTestAta(mint, secondPlayerPublicKey, 100_000000000),
      lamports: 1_000000000,
      owner: TOKEN_PROGRAM_ID,
      executable: false,
    },
  },
];
