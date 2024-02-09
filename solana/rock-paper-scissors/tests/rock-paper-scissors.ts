import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import { ProgramTestContext, startAnchor } from "solana-bankrun";
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

const FIRST_GAME = {
  gameId: "game1",
  firstPlayerChoice: Choice.Rock,
  firstPlayerSalt: getSalt(),
  secondPlayerChoice: Choice.Paper,
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
 * First player's escrow
 */
let firstGameFirstPlayerEscrowAta: anchor.web3.PublicKey;
/**
 * Second player's escrow
 */
let firstGameSecondPlayerEscrowAta: anchor.web3.PublicKey;

describe("Rock Paper Scissors - Happy Path", () => {
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

  it("Initializes settings", async () => {
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

  it("Updates settings", async () => {
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

  it("[First Game] First player: Initializes first game", async () => {
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

  it("[First Game] Second player: Joins first game", async () => {
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

  it("[First Game] First player: Reveals for first game", async () => {
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

  it("[First Game] Second player: Reveals for first game", async () => {
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

  it("[First Game] Permissionless: Settles first game", async () => {
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
  });
});
