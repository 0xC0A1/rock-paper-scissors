import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import { Clock, ProgramTestContext, startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import toml from "toml";
import fs from "fs/promises";
import { IDL, RockPaperScissors } from "../target/types/rock_paper_scissors";

import { buildEscrowPda, buildGamePda, buildSettingsPda } from "./lib/pda";
import { readWalletFromFile, sendSignedVersionedTx } from "./lib/solana";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { Choice, choiceToString } from "./lib/choice";
import { getHashedSaltAndChoice, getSalt } from "./lib/hashing";
import { buildAccounts as buildTestAccounts } from "./test-accounts";
import { expect } from "chai";

const MAINNET_RPC =
  process.env.MAINNET_RPC || "https://api.mainnet-beta.solana.com";

export const USDC_MINT = new anchor.web3.PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

const TIME_FOR_PENALIZATION = new anchor.BN(60 * 60 * 24 * 7);
const TIME_FOR_STALE = new anchor.BN(60 * 60 * 24 * 7);
const PREV_FEE_LAMPORTS = new anchor.BN(0.02 * anchor.web3.LAMPORTS_PER_SOL);
const FEE_LAMPORTS = new anchor.BN(0.025 * anchor.web3.LAMPORTS_PER_SOL);

const readTomlFile = async (path: string) =>
  toml.parse(await fs.readFile(path, "utf-8"));

/**
 * [First Game - Happy Path]
 */
const FIRST_GAME = {
  gameId: "game1",
  firstPlayerChoice: Choice.Rock,
  firstPlayerSalt: getSalt(),
  secondPlayerChoice: Choice.Paper,
  secondPlayerSalt: getSalt(),
  amountToMatch: new BN(10_000000000),
};

/**
 * [Second Game - Forfeit Path]
 */
const SECOND_GAME = {
  gameId: "game2",
  firstPlayerChoice: Choice.Paper,
  firstPlayerSalt: getSalt(),
  secondPlayerChoice: Choice.Scissors,
  secondPlayerSalt: getSalt(),
  amountToMatch: new BN(10_000000000),
};

// Anchor + Bankrun Tooling
let context: ProgramTestContext;
let provider: BankrunProvider;
let program: anchor.Program<RockPaperScissors>;

/**
 * Treasury authority
 */
let authority: anchor.web3.Keypair;
/**
 * Global settings
 */
let settingsPda: anchor.web3.PublicKey;

/**
 * First player
 */
const firstPlayer = anchor.web3.Keypair.generate();
/**
 * First player's USDC token account
 */
let firstPlayerAta: anchor.web3.PublicKey;
/**
 * Second player
 */
const secondPlayer = anchor.web3.Keypair.generate();
/**
 * Second player's USDC token account
 */
let secondPlayerAta: anchor.web3.PublicKey;

/**
 * First game
 */
let firstGamePda: anchor.web3.PublicKey;
/**
 * First game - First player's escrow
 */
let firstGameFirstPlayerEscrowAta: anchor.web3.PublicKey;
/**
 * First game - Second player's escrow
 */
let firstGameSecondPlayerEscrowAta: anchor.web3.PublicKey;

/**
 * Second game
 */
let secondGamePda: anchor.web3.PublicKey;
/**
 * Second game - First player's escrow
 */
let secondGameFirstPlayerEscrowAta: anchor.web3.PublicKey;
/**
 * Second game - Second player's escrow
 */
let secondGameSecondPlayerEscrowAta: anchor.web3.PublicKey;

describe("Rock Paper Scissors - Test Suite", () => {
  before(async () => {
    const mainnetConnection = new anchor.web3.Connection(MAINNET_RPC);
    const anchorToml = (await readTomlFile("Anchor.toml")) as {
      programs: { localnet: { rock_paper_scissors: string } };
      provider: { wallet: string };
    };
    authority = await readWalletFromFile(anchorToml.provider.wallet);
    firstPlayerAta = getAssociatedTokenAddressSync(
      USDC_MINT,
      firstPlayer.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    secondPlayerAta = getAssociatedTokenAddressSync(
      USDC_MINT,
      secondPlayer.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    context = await startAnchor(
      "./",
      [],
      await buildTestAccounts(
        authority.publicKey,
        firstPlayer.publicKey,
        firstPlayerAta,
        secondPlayer.publicKey,
        secondPlayerAta,
        mainnetConnection
      )
    );
    provider = new BankrunProvider(context);
    program = new anchor.Program<RockPaperScissors>(
      IDL,
      anchorToml.programs.localnet.rock_paper_scissors,
      provider
    );
  });

  it("[Settings] Initializes settings", async () => {
    const [settings] = buildSettingsPda(program);

    const ix = await program.methods
      .initializeSettings(
        TIME_FOR_PENALIZATION,
        TIME_FOR_STALE,
        PREV_FEE_LAMPORTS
      )
      .accountsStrict({
        settings: settings,
        signer: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      authority.publicKey,
      [authority],
      ...[ix]
    );

    settingsPda = settings;

    console.log("txId:", txId);
  });

  it("[Settings] Updates settings", async () => {
    const ix = await program.methods
      .updateSettings(TIME_FOR_PENALIZATION, TIME_FOR_STALE, FEE_LAMPORTS)
      .accountsStrict({
        settings: settingsPda,
        signer: authority.publicKey,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      authority.publicKey,
      [authority],
      ...[ix]
    );

    console.log("txId:", txId);
  });

  it("[First Game - Happy Path] First player: Initializes first game", async () => {
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
        mint: USDC_MINT,
        player: firstPlayer.publicKey,
        playerTokenAccount: firstPlayerAta,
        settings: settingsPda,
        playerEscrowTokenAccount: escrow,
        treasury: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      firstPlayer.publicKey,
      [firstPlayer],
      ...[ix]
    );

    firstGameFirstPlayerEscrowAta = escrow;
    firstGamePda = game;

    console.log("txId:", txId);
  });

  it("[First Game - Happy Path] Second player: Joins first game", async () => {
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
        mint: USDC_MINT,
        player: secondPlayer.publicKey,
        playerEscrowTokenAccount: escrow,
        playerTokenAccount: secondPlayerAta,
        settings: settingsPda,
        treasury: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      secondPlayer.publicKey,
      [secondPlayer],
      ...[ix]
    );

    firstGameSecondPlayerEscrowAta = escrow;

    console.log("txId:", txId);
  });

  it("[First Game - Happy Path] First player: Can't be cancelled since another player joined", async () => {
    const ix = await program.methods
      .cancelGame()
      .accountsStrict({
        game: firstGamePda,
        player: firstPlayer.publicKey,
        mint: USDC_MINT,
        playerEscrowTokenAccount: firstGameFirstPlayerEscrowAta,
        playerTokenAccount: firstPlayerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    try {
      await sendSignedVersionedTx(
        provider,
        firstPlayer.publicKey,
        [firstPlayer],
        ...[ix]
      );
    } catch (error) {
      if (error instanceof anchor.web3.SendTransactionError) {
        console.log(error.message);
        expect(error.message).to.equal(
          "Error processing Instruction 0: custom program error: 0x1771"
        );
      } else {
        throw error;
      }
    }
  });

  it("[First Game - Happy Path] First player: Reveals for first game", async () => {
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
      provider,
      firstPlayer.publicKey,
      [firstPlayer],
      ...[ix]
    );

    console.log("txId:", txId);
  });

  it("[First Game - Happy Path] Permissionless: Can't be unwinded since at least one player revealed", async () => {
    const ix = await program.methods
      .unwindGame()
      .accountsStrict({
        game: firstGamePda,
        mint: USDC_MINT,
        firstPlayer: firstPlayer.publicKey,
        firstPlayerEscrowTokenAccount: firstGameFirstPlayerEscrowAta,
        firstPlayerTokenAccount: firstPlayerAta,
        secondPlayer: secondPlayer.publicKey,
        secondPlayerEscrowTokenAccount: firstGameSecondPlayerEscrowAta,
        secondPlayerTokenAccount: secondPlayerAta,
        settings: settingsPda,
        signer: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    try {
      await sendSignedVersionedTx(
        provider,
        authority.publicKey,
        [authority],
        ...[ix]
      );
    } catch (error) {
      if (error instanceof anchor.web3.SendTransactionError) {
        console.log(error.message);
        expect(error.message).to.equal(
          "Error processing Instruction 0: custom program error: 0x1775"
        );
      } else {
        throw error;
      }
    }
  });

  it("[First Game - Happy Path] Second player: Reveals for first game", async () => {
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
      provider,
      secondPlayer.publicKey,
      [secondPlayer],
      ...[ix]
    );

    console.log("txId:", txId);
  });

  it("[First Game - Happy Path] Permissionless: Settles first game", async () => {
    const ix = await program.methods
      .settleGame()
      .accountsStrict({
        game: firstGamePda,
        mint: USDC_MINT,
        firstPlayer: firstPlayer.publicKey,
        firstPlayerEscrowTokenAccount: firstGameFirstPlayerEscrowAta,
        firstPlayerTokenAccount: firstPlayerAta,
        secondPlayer: secondPlayer.publicKey,
        secondPlayerEscrowTokenAccount: firstGameSecondPlayerEscrowAta,
        secondPlayerTokenAccount: secondPlayerAta,
        settings: settingsPda,
        signer: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      authority.publicKey,
      [authority],
      ...[ix]
    );

    console.log("txId:", txId);

    const gameAccount = await program.account.game.fetch(firstGamePda);
    expect(Object.keys(gameAccount.state)[0]).to.equal("secondPlayerWon");
  });

  it("[Second Game - Forfeit Path] First player: Initializes second game", async () => {
    const [game] = buildGamePda(
      program,
      firstPlayer.publicKey,
      SECOND_GAME.gameId
    );
    const [escrow] = buildEscrowPda(program, game, firstPlayer.publicKey);

    const hash = await getHashedSaltAndChoice(
      SECOND_GAME.firstPlayerChoice,
      SECOND_GAME.firstPlayerSalt
    );

    const ix = await program.methods
      .initializeGame(SECOND_GAME.gameId, SECOND_GAME.amountToMatch, [...hash])
      .accountsStrict({
        game,
        mint: USDC_MINT,
        player: firstPlayer.publicKey,
        playerTokenAccount: firstPlayerAta,
        settings: settingsPda,
        playerEscrowTokenAccount: escrow,
        treasury: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      firstPlayer.publicKey,
      [firstPlayer],
      ...[ix]
    );

    secondGamePda = game;
    secondGameFirstPlayerEscrowAta = escrow;

    console.log("txId:", txId);
  });

  it("[Second Game - Forfeit Path] Second player: Joins second game", async () => {
    const [escrow] = buildEscrowPda(
      program,
      secondGamePda,
      secondPlayer.publicKey
    );

    const hash = await getHashedSaltAndChoice(
      SECOND_GAME.secondPlayerChoice,
      SECOND_GAME.secondPlayerSalt
    );

    const ix = await program.methods
      .joinGame([...hash])
      .accountsStrict({
        game: secondGamePda,
        mint: USDC_MINT,
        player: secondPlayer.publicKey,
        playerEscrowTokenAccount: escrow,
        playerTokenAccount: secondPlayerAta,
        settings: settingsPda,
        treasury: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      secondPlayer.publicKey,
      [secondPlayer],
      ...[ix]
    );

    secondGameSecondPlayerEscrowAta = escrow;

    console.log("txId:", txId);
  });

  it("[Second Game - Forfeit Path] First player: Reveals for second game", async () => {
    const ix = await program.methods
      .revealChoice(
        { [choiceToString(SECOND_GAME.firstPlayerChoice)]: {} } as any,
        [...SECOND_GAME.firstPlayerSalt]
      )
      .accountsStrict({
        game: secondGamePda,
        player: firstPlayer.publicKey,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      firstPlayer.publicKey,
      [firstPlayer],
      ...[ix]
    );

    console.log("txId:", txId);
  });

  it("[Second Game - Forfeit Path] Advance time for forfeit", async () => {
    const currentClock = await context.banksClient.getClock();
    const currentTimestamp = currentClock.unixTimestamp;
    const newTimestamp =
      currentTimestamp + BigInt(TIME_FOR_PENALIZATION.toNumber());
    context.setClock(
      new Clock(
        currentClock.slot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        newTimestamp
      )
    );
    console.log(
      `Current timestamp: ${
        currentClock.unixTimestamp
      }, New timestamp: ${newTimestamp}, diff: ${
        newTimestamp - currentClock.unixTimestamp
      }, Time for penalization: ${TIME_FOR_PENALIZATION}`
    );
  });

  it("[Second Game - Forfeit Path] Permissionless: Settles second game", async () => {
    const ix = await program.methods
      .settleGame()
      .accountsStrict({
        game: secondGamePda,
        mint: USDC_MINT,
        firstPlayer: firstPlayer.publicKey,
        firstPlayerEscrowTokenAccount: secondGameFirstPlayerEscrowAta,
        firstPlayerTokenAccount: firstPlayerAta,
        secondPlayer: secondPlayer.publicKey,
        secondPlayerEscrowTokenAccount: secondGameSecondPlayerEscrowAta,
        secondPlayerTokenAccount: secondPlayerAta,
        settings: settingsPda,
        signer: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const txId = await sendSignedVersionedTx(
      provider,
      authority.publicKey,
      [authority],
      ...[ix]
    );

    console.log("txId:", txId);

    const gameAccount = await program.account.game.fetch(secondGamePda);
    expect(Object.keys(gameAccount.state)[0]).to.equal("firstPlayerWon");
  });
});
