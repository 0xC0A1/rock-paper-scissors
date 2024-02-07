/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type CancelGameInstructionAccounts = {
  game: PublicKey | Pda;
  playerEscrowTokenAccount: PublicKey | Pda;
  playerTokenAccount: PublicKey | Pda;
  mint: PublicKey | Pda;
  tokenProgram?: PublicKey | Pda;
  player: Signer;
};

// Instruction.
export function cancelGame(
  context: Pick<Context, 'programs'>,
  input: CancelGameInstructionAccounts
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'rockPaperScissors',
    'rock7uz5eZdz8fb1ZEfZ1aR428ncvkYBrgebwyzaqBG'
  );

  // Accounts.
  const resolvedAccounts = {
    game: { index: 0, isWritable: true as boolean, value: input.game ?? null },
    playerEscrowTokenAccount: {
      index: 1,
      isWritable: true as boolean,
      value: input.playerEscrowTokenAccount ?? null,
    },
    playerTokenAccount: {
      index: 2,
      isWritable: true as boolean,
      value: input.playerTokenAccount ?? null,
    },
    mint: { index: 3, isWritable: false as boolean, value: input.mint ?? null },
    tokenProgram: {
      index: 4,
      isWritable: false as boolean,
      value: input.tokenProgram ?? null,
    },
    player: {
      index: 5,
      isWritable: false as boolean,
      value: input.player ?? null,
    },
  } satisfies ResolvedAccountsWithIndices;

  // Default values.
  if (!resolvedAccounts.tokenProgram.value) {
    resolvedAccounts.tokenProgram.value = context.programs.getPublicKey(
      'splToken',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    );
    resolvedAccounts.tokenProgram.isWritable = false;
  }

  // Accounts in order.
  const orderedAccounts: ResolvedAccount[] = Object.values(
    resolvedAccounts
  ).sort((a, b) => a.index - b.index);

  // Keys and Signers.
  const [keys, signers] = getAccountMetasAndSigners(
    orderedAccounts,
    'programId',
    programId
  );

  // Data.
  const data = new Uint8Array();

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
