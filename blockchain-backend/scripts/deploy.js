// FILE -> Writing/DefiningDeployingScripts

const {ethers, run, network} = require("hardhat");

async function main() {
  console.log("Deploying contract \u23F3");

  const NFTMarket = await ethers.getContractFactory("NFTMarket");
  const nftMarket = await NFTMarket.deploy();
  await nftMarket.deployed();

  console.log("Contract deployed successfully \u2705");
  console.log(`Contract address : ${nftMarket.address}`);

  // what happens when we deploy to our hardhat network?
  if (network.config.chainId === 11155111) {
    console.log("Waiting for block confirmations \u23F3");
    // wait6BlockConfirmations
    await nftMarket.deployTransaction.wait(6);
    await verify(nftMarket.address, []);
  }

  // -> contractInterraction
  // const currentValue = await simpleStorage.retrieve();
  // console.log(`Current value : ${currentValue}`);

  // const transactionResponse = await simpleStorage.store(7);
  // await transactionResponse.wait(1);
  // const updatedValue = await simpleStorage.retrieve();
  // console.log(`Updated value : ${updatedValue}`);
}

// async function verify(contractAddress, args) {
const verify = async (contractAddress, args) => {
  console.log("Verifying contract \u23F3");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified!");
    } else {
      console.log(e);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// ToExecute -> npx hardhat run scripts/deploy.js --network <network-name>
