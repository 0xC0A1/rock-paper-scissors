import { web3 } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";
import fs from "fs/promises";

export const sendSignedVersionedTx = async (
  provider: BankrunProvider,
  payer: web3.PublicKey,
  signers: web3.Signer[],
  ...ixs: web3.TransactionInstruction[]
) => {
  const blockhash = provider.context.lastBlockhash;
  const tx = new web3.VersionedTransaction(
    new web3.TransactionMessage({
      payerKey: payer,
      instructions: ixs,
      recentBlockhash: blockhash,
    }).compileToV0Message()
  );
  tx.sign(signers);
  const txId = await provider.sendAndConfirm(tx, signers);
  return txId;
};

export const readWalletFromFile = async (path: string) => {
  const wallet = JSON.parse(await fs.readFile(path, "utf-8")) as number[];
  return web3.Keypair.fromSecretKey(Uint8Array.from(wallet));
};
