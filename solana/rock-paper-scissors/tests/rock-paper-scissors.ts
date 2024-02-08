import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RockPaperScissors } from "../target/types/rock_paper_scissors";

import { buildEscrowPda, buildGamePda, buildSettingsPda } from "./lib/pda";
import { fundAccount, sendSignedVersionedTx } from "./lib/solana";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { Choice, choiceToString } from "./lib/choice";
import { getHashedSaltAndChoice, getSalt } from "./lib/hashing";

const TIME_FOR_PENALIZATION = new anchor.BN(60 * 60 * 24 * 7);
const TIME_FOR_STALE = new anchor.BN(60 * 60 * 24 * 7);
const PREV_FEE_LAMPORTS = new anchor.BN(0.02 * anchor.web3.LAMPORTS_PER_SOL);
const FEE_LAMPORTS = new anchor.BN(0.025 * anchor.web3.LAMPORTS_PER_SOL);

const FIRST_GAME = {
  gameId: "game1",
  firstPlayerChoice: Choice.Rock,
  firstPlayerSalt: getSalt(),
  secondPlayerChoice: Choice.Paper,
  secondPlayerSalt: getSalt(),
  amountToMatch: new BN(100_000000000),
};

const prepareAccount = async (
  authority: anchor.web3.Keypair,
  targetAccount: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey,
  connection: anchor.web3.Connection
) => {
  const fundAccountTxId = await fundAccount(targetAccount, connection);
  const ata = await createAssociatedTokenAccount(
    connection,
    authority,
    mint,
    targetAccount,
    undefined,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const mintToTxId = await mintTo(
    connection,
    authority,
    mint,
    ata,
    authority,
    1000_000000000,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  return { fundAccountTxId, mintToTxId, ata };
};

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
  let firstGamePda: anchor.web3.PublicKey;
  let secondGamePda: anchor.web3.PublicKey;

  const firstPlayer = anchor.web3.Keypair.generate();
  let firstPlayerAta: anchor.web3.PublicKey;
  let firstPlayerEscrowAta: anchor.web3.PublicKey;
  const secondPlayer = anchor.web3.Keypair.generate();
  let secondPlayerAta: anchor.web3.PublicKey;
  let secondPlayerEscrowAta: anchor.web3.PublicKey;

  before(async () => {
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
    const { ata: firstPlayerAtaResult } = await prepareAccount(
      wallet.payer,
      firstPlayer.publicKey,
      mint,
      program.provider.connection
    );
    firstPlayerAta = firstPlayerAtaResult;
    const { ata: secondPlayerAtaResult } = await prepareAccount(
      wallet.payer,
      secondPlayer.publicKey,
      mint,
      program.provider.connection
    );
    secondPlayerAta = secondPlayerAtaResult;
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

  it("Initializes a game", async () => {
    const [game] = buildGamePda(
      program,
      firstPlayer.publicKey,
      FIRST_GAME.gameId
    );
    const [escrow] = buildEscrowPda(program, game, firstPlayer.publicKey);

    const hash = await getHashedSaltAndChoice(
      FIRST_GAME.firstPlayerChoice,
      FIRST_GAME.firstPlayerSalt
    );

    const ix = await program.methods
      .initializeGame(FIRST_GAME.gameId, FIRST_GAME.amountToMatch, [...hash])
      .accountsStrict({
        game,
        mint,
        player: firstPlayer.publicKey,
        playerTokenAccount: firstPlayerAta,
        settings: settingsPda,
        playerEscrowTokenAccount: escrow,
        treasury: authority,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      program.provider.connection,
      firstPlayer.publicKey,
      [firstPlayer],
      ...[ix]
    );

    firstPlayerEscrowAta = escrow;
    firstGamePda = game;

    console.log("txId:", txId);
  });

  it("Joins a game", async () => {
    const [escrow] = buildEscrowPda(
      program,
      firstGamePda,
      secondPlayer.publicKey
    );

    const hash = await getHashedSaltAndChoice(
      FIRST_GAME.secondPlayerChoice,
      FIRST_GAME.secondPlayerSalt
    );

    const ix = await program.methods
      .joinGame([...hash])
      .accountsStrict({
        game: firstGamePda,
        mint,
        player: secondPlayer.publicKey,
        playerEscrowTokenAccount: escrow,
        playerTokenAccount: secondPlayerAta,
        settings: settingsPda,
        treasury: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      program.provider.connection,
      secondPlayer.publicKey,
      [secondPlayer],
      ...[ix]
    );

    secondPlayerEscrowAta = escrow;

    console.log("txId:", txId);
  });

  it("First player reveals", async () => {
    const ix = await program.methods
      .revealChoice(
        { [choiceToString(FIRST_GAME.firstPlayerChoice)]: {} } as any,
        [...FIRST_GAME.firstPlayerSalt]
      )
      .accountsStrict({
        game: firstGamePda,
        player: firstPlayer.publicKey,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      program.provider.connection,
      firstPlayer.publicKey,
      [firstPlayer],
      ...[ix]
    );

    console.log("txId:", txId);
  });

  it("Second player reveals", async () => {
    const ix = await program.methods
      .revealChoice(
        { [choiceToString(FIRST_GAME.secondPlayerChoice)]: {} } as any,
        [...FIRST_GAME.secondPlayerSalt]
      )
      .accountsStrict({
        game: firstGamePda,
        player: secondPlayer.publicKey,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      program.provider.connection,
      secondPlayer.publicKey,
      [secondPlayer],
      ...[ix]
    );

    console.log("txId:", txId);
  });

  it("Settles the game", async () => {
    const txId = await program.methods
      .settleGame()
      .accountsStrict({
        game: firstGamePda,
        mint,
        firstPlayer: firstPlayer.publicKey,
        firstPlayerEscrowTokenAccount: firstPlayerEscrowAta,
        firstPlayerTokenAccount: firstPlayerAta,
        secondPlayer: secondPlayer.publicKey,
        secondPlayerEscrowTokenAccount: secondPlayerEscrowAta,
        secondPlayerTokenAccount: secondPlayerAta,
        settings: settingsPda,
        signer: authority,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc({ skipPreflight: true });

    console.log("txId:", txId);
  });
});
