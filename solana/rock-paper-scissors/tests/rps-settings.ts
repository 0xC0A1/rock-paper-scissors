import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RockPaperScissors } from "../target/types/rock_paper_scissors";

import { buildSettingsPda } from "./lib/pda";

const TIME_FOR_PENALIZATION = new anchor.BN(60 * 60 * 24 * 7);
const TIME_FOR_STALE = new anchor.BN(60 * 60 * 24 * 7);
const PREV_FEE_LAMPORTS = new anchor.BN(0.02 * anchor.web3.LAMPORTS_PER_SOL);
const FEE_LAMPORTS = new anchor.BN(0.025 * anchor.web3.LAMPORTS_PER_SOL);

describe("Rock Paper Scissors - Full Suite", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .RockPaperScissors as Program<RockPaperScissors>;

  let settingsPda: anchor.web3.PublicKey;

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
        signer: program.provider.publicKey,
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
        signer: program.provider.publicKey,
      })
      .rpc();

    console.log("txId:", txId);
  });
});
