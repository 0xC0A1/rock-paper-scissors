import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RockPaperScissors } from "../target/types/rock_paper_scissors";

import { buildGamePda, buildSettingsPda } from "./lib/pda";
import { fundAccount } from "./lib/solana";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
} from "@solana/spl-token";
import { BN } from "bn.js";

const TIME_FOR_PENALIZATION = new anchor.BN(60 * 60 * 24 * 7);
const TIME_FOR_STALE = new anchor.BN(60 * 60 * 24 * 7);
const PREV_FEE_LAMPORTS = new anchor.BN(0.02 * anchor.web3.LAMPORTS_PER_SOL);
const FEE_LAMPORTS = new anchor.BN(0.025 * anchor.web3.LAMPORTS_PER_SOL);
const GAME_ID = "game1";

describe("Rock Paper Scissors - Full Suite", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .RockPaperScissors as Program<RockPaperScissors>;

  const provider = program.provider as anchor.AnchorProvider;
  const wallet = provider.wallet as anchor.Wallet;
  const authority = wallet.publicKey;

  let mint: anchor.web3.PublicKey;
  let settingsPda: anchor.web3.PublicKey;

  const firstPlayer = anchor.web3.Keypair.generate();
  let firstPlayerAta: anchor.web3.PublicKey;
  const secondPlayer = anchor.web3.Keypair.generate();
  let secondPlayerAta: anchor.web3.PublicKey;

  before(async () => {
    await fundAccount(firstPlayer.publicKey, program.provider.connection);
    await fundAccount(secondPlayer.publicKey, program.provider.connection);
    mint = await createMint(
      program.provider.connection,
      wallet.payer,
      authority,
      authority,
      9,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    firstPlayerAta = await createAssociatedTokenAccount(
      program.provider.connection,
      firstPlayer,
      mint,
      firstPlayer.publicKey,
      undefined,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    secondPlayerAta = await createAssociatedTokenAccount(
      program.provider.connection,
      secondPlayer,
      mint,
      secondPlayer.publicKey,
      {},
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  });

  it("Initializes settings", async () => {
    const [settings] = buildSettingsPda(program);

    const txId = await program.methods
      .initializeSettings(
        TIME_FOR_PENALIZATION,
        TIME_FOR_STALE,
        PREV_FEE_LAMPORTS
      )
      .accountsStrict({
        settings: settings,
        signer: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    settingsPda = settings;

    console.log("txId:", txId);
  });

  it("Updates settings", async () => {
    const txId = await program.methods
      .updateSettings(TIME_FOR_PENALIZATION, TIME_FOR_STALE, FEE_LAMPORTS)
      .accountsStrict({
        settings: settingsPda,
        signer: authority,
      })
      .rpc();

    console.log("txId:", txId);
  });

  it("Creates a game", async () => {
    const [game] = buildGamePda(program, firstPlayer.publicKey, GAME_ID);

    const txId = await program.methods
      .initializeGame(GAME_ID, new BN(100), [])
      .accountsStrict({
        game,
        mint,
        player: firstPlayer.publicKey,
        playerTokenAccount: firstPlayerAta,
        settings: settingsPda,
        playerEscrowTokenAccount: firstPlayerAta,
        treasury: authority,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("txId:", txId);
  });
});
