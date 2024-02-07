import { web3 } from "@coral-xyz/anchor";

export const fundAccount = async (
  connection: web3.Connection,
  account: web3.PublicKey
) => {
  const airdropSignature = await connection.requestAirdrop(
    account,
    1 * web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(airdropSignature);
};

export const sendSignedVersionedTx = async (
  connection: web3.Connection,
  payer: web3.PublicKey,
  signers: web3.Signer[],
  ...ixs: web3.TransactionInstruction[]
) => {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  const tx = new web3.VersionedTransaction(
    new web3.TransactionMessage({
      payerKey: payer,
      instructions: ixs,
      recentBlockhash: blockhash,
    }).compileToV0Message()
  );
  tx.sign(signers);
  const txId = await connection.sendTransaction(tx, { skipPreflight: true });
  // confirm
  const result = await connection.confirmTransaction({
    blockhash,
    lastValidBlockHeight,
    signature: txId,
  });
  if (result.value.err) {
    console.log("[FAILED]: txId", txId);
    throw result.value.err;
  }
  return txId;
};
