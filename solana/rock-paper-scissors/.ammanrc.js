// @ts-check
"use strict";
const path = require("path");

const localDeployDir = path.join(__dirname, "target", "deploy");

const mainnetClusterRpc =
  "https://mainnet.helius-rpc.com/?api-key=7241e63e-9c88-4ea2-a283-ad8f6cf4776b";
const devnetClusterRpc =
  "https://devnet.helius-rpc.com/?api-key=7241e63e-9c88-4ea2-a283-ad8f6cf4776b";

/**
 * @param {string} programName
 */
const localDeployPath = (programName) =>
  path.join(localDeployDir, `${programName}.so`);

const programs = [
  // Skipping since we use anchor to test.
  // {
  //   label: "points_program",
  //   programId: POINTS_PROGRAM_ID,
  //   deployPath: localDeployPath("points_program"),
  // },
];

const rpsProgramAccounts = [
  {
    cluster: devnetClusterRpc,
    label: "Rock Paper Scissors - Treasury",
    accountId: "rpstBRQkjzHZhsJKL6ENJXicc6nq2x49pDq7iTSRmuD",
  },
];

const accounts = [...rpsProgramAccounts];

const validator = {
  programs,
  // Uncomment if you want to pull remote accounts. Check Amman docs for more info
  accounts,
  verifyFees: false,
  limitLedgerSize: 10000000,
};

module.exports = {
  validator,
};
