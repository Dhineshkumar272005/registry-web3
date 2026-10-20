const { ethers, network } = require("hardhat");
(async () => {
  const c = await (await ethers.getContractFactory("TrialRegistry")).deploy();
  await c.waitForDeployment();
  console.log(`Deployed on ${network.name}: ${await c.getAddress()}\nSet NEXT_PUBLIC_REGISTRY_ADDRESS to this value.`);
})();
