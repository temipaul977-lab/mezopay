const hre = require("hardhat");
const fs = require("node:fs/promises");
const path = require("node:path");

const MUSD_TOKEN = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork();
  if (chainId !== 31611n) {
    throw new Error("Deploy with --network mezoTestnet (chain ID 31611)");
  }
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("Set PRIVATE_KEY in contracts/.env before deploying");
  if ((await hre.ethers.provider.getCode(MUSD_TOKEN)) === "0x") {
    throw new Error("No MUSD contract found at the configured testnet address");
  }

  const contract = await hre.ethers.deployContract("MezoPayInvoices", [MUSD_TOKEN]);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const explorerUrl = `https://explorer.test.mezo.org/address/${address}`;
  console.log(`MezoPayInvoices deployed to: ${address}`);
  console.log(`Explorer: ${explorerUrl}`);

  const { abi } = await hre.artifacts.readArtifact("MezoPayInvoices");
  const output = path.resolve(__dirname, "../../frontend/src/contracts/MezoPayInvoices.json");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ address, abi, chainId: Number(chainId), musdToken: MUSD_TOKEN, explorerUrl }, null, 2) + "\n");
  console.log(`Deployment address and ABI saved to: ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
