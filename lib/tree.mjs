import { keccak256, toUtf8Bytes, concat, toBeHex, randomBytes, hexlify } from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

// The padding leaves are derived from a signature only the wallet owner can produce, so the same wallet and the same
// tags always rebuild the same tree. Nothing has to be backed up, and the padding stays secret from everyone else.
export const SEED_MESSAGE = "Rare Trial Registry: derive my private proof key. Signing this message does not move funds.";
export const tagLeaf = (t) => keccak256(toUtf8Bytes(t.trim().toLowerCase()));
export function buildTree(tags, seed) {
  const leaves = [...new Set(tags.map(tagLeaf))];
  const key = seed ? keccak256(seed) : null;
  for (let i = 0; leaves.length < 16; i++) leaves.push(key ? keccak256(concat([key, toBeHex(i, 32)])) : hexlify(randomBytes(32)));
  return StandardMerkleTree.of(leaves.map((l) => [l]), ["bytes32"]);
}
