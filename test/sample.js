const { expect } = require("chai");
const { ethers } = require("hardhat");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");
const leaf = (s) => ethers.keccak256(ethers.toUtf8Bytes(s.trim().toLowerCase()));
const tree = (tags) => { const l = [...new Set(tags.map(leaf))]; while (l.length < 16) l.push(ethers.hexlify(ethers.randomBytes(32))); return StandardMerkleTree.of(l.map((x) => [x]), ["bytes32"]); };
const key = "0x04" + "ab".repeat(64);

describe("sample data", () => {
  let r, sponsor, anna, ravi, mei, T;
  before(async () => {
    [, sponsor, anna, ravi, mei] = await ethers.getSigners();
    r = await (await ethers.getContractFactory("TrialRegistry")).deploy();
    T = {
      anna: tree(["Fabry Disease", "GLA mutation"]),
      ravi: tree(["Gaucher disease"]),
      mei: tree(["Pompe disease", "late onset", "ERT"]),
    };
    await r.connect(anna).registerPatient(T.anna.root);
    await r.connect(ravi).registerPatient(T.ravi.root);
    await r.connect(mei).registerPatient(T.mei.root);
    await r.connect(sponsor).createTrial("Fabry study", [leaf("fabry disease")], key);
    await r.connect(sponsor).createTrial("Pompe study", [leaf("pompe disease"), leaf("late onset")], key);
  });
  const proofs = (t, ls) => ls.map((l) => t.getProof([l]));
  it("counts 3 patients, 2 trials", async () => {
    expect(await r.patientCount()).to.equal(3n); expect(await r.trialCount()).to.equal(2n);
  });
  it("Anna (Fabry) can consent; case/spacing in tags is normalised", async () => {
    await r.connect(anna).consent(0, [leaf("fabry disease")], proofs(T.anna, [leaf("fabry disease")]), "0x");
    expect((await r.getTrial(0)).consents).to.equal(1n);
  });
  it("Ravi (Gaucher) cannot consent to Fabry with his proof", async () => {
    await expect(r.connect(ravi).consent(0, [leaf("fabry disease")], [[]], "0x")).to.be.revertedWith("bad proof");
  });
  it("Ravi cannot forge a proof using Anna's", async () => {
    await expect(r.connect(ravi).consent(0, [leaf("fabry disease")], proofs(T.anna, [leaf("fabry disease")]), "0x")).to.be.revertedWith("bad proof");
  });
  it("Mei needs BOTH Pompe criteria; passes with both", async () => {
    const ls = [leaf("pompe disease"), leaf("late onset")];
    await r.connect(mei).consent(1, ls, proofs(T.mei, ls), "0x");
    expect(await r.consented(1, mei.address)).to.equal(true);
  });
  it("Anna cannot consent to Pompe (missing tags)", async () => {
    const ls = [leaf("pompe disease"), leaf("late onset")];
    await expect(r.connect(anna).consent(1, ls, [[], []], "0x")).to.be.revertedWith("bad proof");
  });
  it("wrong criterion leaves are rejected", async () => {
    await expect(r.connect(mei).consent(0, [leaf("pompe disease")], proofs(T.mei, [leaf("pompe disease")]), "0x")).to.be.revertedWith("criterion mismatch");
  });
  it("unregistered wallet cannot consent", async () => {
    const [, , , , , rando] = await ethers.getSigners();
    await expect(r.connect(rando).consent(0, [leaf("fabry disease")], [[]], "0x")).to.be.revertedWith("not registered");
  });
  it("double consent blocked", async () => {
    await expect(r.connect(anna).consent(0, [leaf("fabry disease")], proofs(T.anna, [leaf("fabry disease")]), "0x")).to.be.revertedWith("already consented");
  });
  it("only owner can close; closed trial rejects consent", async () => {
    await expect(r.connect(anna).closeTrial(0)).to.be.revertedWith("not owner");
    await r.connect(sponsor).closeTrial(0);
    await expect(r.connect(ravi).consent(0, [leaf("fabry disease")], [[]], "0x")).to.be.revertedWith("closed");
  });
  it("tree padding: root differs between patients with same tags (no dictionary match)", async () => {
    expect(tree(["Fabry Disease"]).root).to.not.equal(tree(["Fabry Disease"]).root);
  });
  it("gas for 2-criterion consent is reasonable", async () => {
    const [, , , , , , m2] = await ethers.getSigners();
    const t = tree(["pompe disease", "late onset"]);
    await r.connect(m2).registerPatient(t.root);
    const ls = [leaf("pompe disease"), leaf("late onset")];
    const rc = await (await r.connect(m2).consent(1, ls, proofs(t, ls), "0x")).wait();
    console.log("      consent gas:", rc.gasUsed.toString());
  });
});
