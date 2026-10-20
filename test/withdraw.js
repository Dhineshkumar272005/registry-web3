const { expect } = require("chai");
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const leaf = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
const mk = (tags) => { const l = tags.map(leaf); while (l.length < 16) l.push(ethers.hexlify(ethers.randomBytes(32))); return StandardMerkleTree.of(l.map((x) => [x]), ["bytes32"]); };
describe("consent withdrawal", () => {
  let r, sponsor, pat, other, t, lf;
  beforeEach(async () => {
    [, sponsor, pat, other] = await ethers.getSigners();
    r = await (await ethers.getContractFactory("TrialRegistry")).deploy();
    t = mk(["fabry disease"]); lf = [leaf("fabry disease")];
    await r.connect(pat).registerPatient(t.root);
    await r.connect(sponsor).createTrial("Fabry study", lf, "0x04" + "11".repeat(64));
    await r.connect(pat).consent(0, lf, [t.getProof(lf)], "0x");
  });
  it("removes the consent, lowers the count and emits an event", async () => {
    await expect(r.connect(pat).withdraw(0)).to.emit(r, "Withdrawn").withArgs(0, pat.address);
    expect(await r.consented(0, pat.address)).to.equal(false);
    expect((await r.getTrial(0)).consents).to.equal(0n);
  });
  it("cannot withdraw twice, and strangers cannot withdraw", async () => {
    await r.connect(pat).withdraw(0);
    await expect(r.connect(pat).withdraw(0)).to.be.revertedWith("no consent");
    await expect(r.connect(other).withdraw(0)).to.be.revertedWith("no consent");
  });
  it("allows consenting again after withdrawing", async () => {
    await r.connect(pat).withdraw(0);
    await r.connect(pat).consent(0, lf, [t.getProof(lf)], "0x");
    expect((await r.getTrial(0)).consents).to.equal(1n);
  });
  it("allows withdrawing from a closed trial", async () => {
    await r.connect(sponsor).closeTrial(0);
    await r.connect(pat).withdraw(0);
    expect((await r.getTrial(0)).consents).to.equal(0n);
  });
});
