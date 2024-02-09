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
  ACCOUNT_SIZE,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AccountLayout,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { Choice, choiceToString } from "./lib/choice";
import { getHashedSaltAndChoice, getSalt } from "./lib/hashing";

const MAINNET_RPC =
  process.env.MAINNET_RPC || "https://api.mainnet-beta.solana.com";

const USDC_MINT = new anchor.web3.PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

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
  amountToMatch: new BN(10_000000000),
};

const buildLocalTestAta = (
  mint: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  amount: number
) => {
  const ataBuffer = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      mint,
      owner,
      amount: BigInt(amount),
      delegateOption: 0,
      delegate: anchor.web3.PublicKey.default,
      delegatedAmount: BigInt(0),
      state: 1,
      isNativeOption: 0,
      isNative: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: anchor.web3.PublicKey.default,
    },
    ataBuffer
  );
  return ataBuffer;
};

const readTomlFile = async (path: string) =>
  toml.parse(await fs.readFile(path, "utf-8"));

let context: ProgramTestContext;
let provider: BankrunProvider;
let rpsProgram: anchor.Program<RockPaperScissors>;

let settingsPda: anchor.web3.PublicKey;
let firstGamePda: anchor.web3.PublicKey;

let authority: anchor.web3.Keypair;

const firstPlayer = anchor.web3.Keypair.generate();
let firstPlayerAta: anchor.web3.PublicKey;
let firstPlayerEscrowAta: anchor.web3.PublicKey;
const secondPlayer = anchor.web3.Keypair.generate();
let secondPlayerAta: anchor.web3.PublicKey;
let secondPlayerEscrowAta: anchor.web3.PublicKey;

describe("Rock Paper Scissors - Happy Path", () => {
  before(async () => {
    const mainnetConnection = new anchor.web3.Connection(MAINNET_RPC);
    const anchorToml = (await readTomlFile("Anchor.toml")) as {
      programs: {
        localnet: {
          rock_paper_scissors: string;
        };
      };
      provider: {
        wallet: string;
      };
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
      [
        // Let's pull USDC mint from mainnet for testing purposes only
        {
          address: USDC_MINT,
          info: await mainnetConnection.getAccountInfo(USDC_MINT),
        },
        // Allocate 1 sol to authority for gas and fees
        {
          address: authority.publicKey,
          info: {
            data: Buffer.alloc(0),
            lamports: 1_000000000,
            owner: anchor.web3.SystemProgram.programId,
            executable: false,
          },
        },
        // Allocate 1 sol to first player for gas and fees
        {
          address: firstPlayer.publicKey,
          info: {
            data: Buffer.alloc(0),
            lamports: 1_000000000,
            owner: anchor.web3.SystemProgram.programId,
            executable: false,
          },
        },
        // Allocate 1 sol to second player for gas and fees
        {
          address: secondPlayer.publicKey,
          info: {
            data: Buffer.alloc(0),
            lamports: 1_000000000,
            owner: anchor.web3.SystemProgram.programId,
            executable: false,
          },
        },
        // Allocate 100 USDC to first player [Printer go brrrr]
        {
          address: firstPlayerAta,
          info: {
            data: buildLocalTestAta(
              USDC_MINT,
              firstPlayer.publicKey,
              100_000000000
            ),
            lamports: 1_000000000,
            owner: TOKEN_PROGRAM_ID,
            executable: false,
          },
        },
        // Allocate 100 USDC to second player [Printer go brrrr]
        {
          address: secondPlayerAta,
          info: {
            data: buildLocalTestAta(
              USDC_MINT,
              secondPlayer.publicKey,
              100_000000000
            ),
            lamports: 1_000000000,
            owner: TOKEN_PROGRAM_ID,
            executable: false,
          },
        },
      ]
    );
    provider = new BankrunProvider(context);

    rpsProgram = new anchor.Program<RockPaperScissors>(
      IDL,
      anchorToml.programs.localnet.rock_paper_scissors,
      provider
    );
  });

  it("Initializes settings", async () => {
    const [settings] = buildSettingsPda(rpsProgram);

    const ix = await rpsProgram.methods
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
    const ix = await rpsProgram.methods
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

  it("Initializes a game", async () => {
    const [game] = buildGamePda(
      rpsProgram,
      firstPlayer.publicKey,
      FIRST_GAME.gameId
    );
    const [escrow] = buildEscrowPda(rpsProgram, game, firstPlayer.publicKey);

    const hash = await getHashedSaltAndChoice(
      FIRST_GAME.firstPlayerChoice,
      FIRST_GAME.firstPlayerSalt
    );

    const ix = await rpsProgram.methods
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

    firstPlayerEscrowAta = escrow;
    firstGamePda = game;

    console.log("txId:", txId);
  });

  it("Joins a game", async () => {
    const [escrow] = buildEscrowPda(
      rpsProgram,
      firstGamePda,
      secondPlayer.publicKey
    );

    const hash = await getHashedSaltAndChoice(
      FIRST_GAME.secondPlayerChoice,
      FIRST_GAME.secondPlayerSalt
    );

    const ix = await rpsProgram.methods
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

    secondPlayerEscrowAta = escrow;

    console.log("txId:", txId);
  });

  it("First player reveals", async () => {
    const ix = await rpsProgram.methods
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

  it("Second player reveals", async () => {
    const ix = await rpsProgram.methods
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

  it("Settles the game", async () => {
    const ix = await rpsProgram.methods
      .settleGame()
      .accountsStrict({
        game: firstGamePda,
        mint: USDC_MINT,
        firstPlayer: firstPlayer.publicKey,
        firstPlayerEscrowTokenAccount: firstPlayerEscrowAta,
        firstPlayerTokenAccount: firstPlayerAta,
        secondPlayer: secondPlayer.publicKey,
        secondPlayerEscrowTokenAccount: secondPlayerEscrowAta,
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
