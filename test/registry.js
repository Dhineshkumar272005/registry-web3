const { expect } = require("chai");
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const k = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
it("verifies proof and records consent", async () => {
  const [, p] = await ethers.getSigners();
  const r = await (await ethers.getContractFactory("TrialRegistry")).deploy();
  const leaves = [k("fabry disease"), k("gla-mutation"), ethers.hexlify(ethers.randomBytes(32))];
  const tree = StandardMerkleTree.of(leaves.map((l) => [l]), ["bytes32"]);
  await r.connect(p).registerPatient(tree.root);
  await r.createTrial("Fabry trial", [leaves[0], leaves[1]], "0x04" + "11".repeat(64));
  const proofs = [leaves[0], leaves[1]].map((l) => tree.getProof([l]));
  await r.connect(p).consent(0, [leaves[0], leaves[1]], proofs, "0x1234");
  expect((await r.getTrial(0)).consents).to.equal(1n);
  await expect(r.connect(p).consent(0, [leaves[0], leaves[1]], proofs, "0x")).to.be.revertedWith("already consented");
});
