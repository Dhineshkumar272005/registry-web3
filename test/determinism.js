const { expect } = require("chai");
const { ethers } = require("hardhat");
describe("recoverable proofs", () => {
  it("rebuilds the same root from the same wallet and tags, and works on-chain", async () => {
    const { buildTree, tagLeaf, SEED_MESSAGE } = await import("../lib/tree.mjs");
    const [, sponsor] = await ethers.getSigners();
    const w = ethers.Wallet.createRandom(), other = ethers.Wallet.createRandom();
    const seed = await w.signMessage(SEED_MESSAGE);
    const a = buildTree(["Fabry Disease", "gla mutation"], seed);
    const b = buildTree(["gla mutation", "fabry disease "], seed);
    expect(a.root).to.equal(b.root);
    expect(buildTree(["fabry disease"], await other.signMessage(SEED_MESSAGE)).root).to.not.equal(buildTree(["fabry disease"], seed).root);
    expect(buildTree(["fabry disease", "extra"], seed).root).to.not.equal(buildTree(["fabry disease"], seed).root);
    const r = await (await ethers.getContractFactory("TrialRegistry")).deploy();
    const funded = w.connect(ethers.provider);
    await sponsor.sendTransaction({ to: w.address, value: ethers.parseEther("1") });
    const lf = [tagLeaf("fabry disease")];
    await r.connect(sponsor).createTrial("Fabry", lf, "0x04" + "11".repeat(64));
    await r.connect(funded).registerPatient(a.root);
    const rebuilt = buildTree(["gla mutation", "Fabry Disease"], seed);
    await r.connect(funded).consent(0, lf, [rebuilt.getProof(lf)], "0x");
    expect((await r.getTrial(0)).consents).to.equal(1n);
  });
});
