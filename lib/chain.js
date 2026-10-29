import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

export const ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
export const CHAIN = {
  hex: process.env.NEXT_PUBLIC_CHAIN_ID_HEX || "0x13882",
  name: process.env.NEXT_PUBLIC_CHAIN_NAME || "Polygon Amoy (test network)",
  symbol: process.env.NEXT_PUBLIC_CHAIN_SYMBOL || "POL",
  rpc: process.env.NEXT_PUBLIC_RPC || "https://rpc-amoy.polygon.technology",
  explorer: process.env.NEXT_PUBLIC_EXPLORER || "https://amoy.polygonscan.com",
};
const ABI = [
  "function registerPatient(bytes32 root)",
  "function createTrial(string title, bytes32[] criteria, bytes pubKey) returns (uint256)",
  "function closeTrial(uint256 id)",
  "function withdraw(uint256 id)",
  "function consent(uint256 id, bytes32[] leaves, bytes32[][] proofs, bytes encContact)",
  "function trialCount() view returns (uint256)",
  "function patientCount() view returns (uint256)",
  "function patientRoot(address) view returns (bytes32)",
  "function consented(uint256, address) view returns (bool)",
  "function getTrial(uint256) view returns (tuple(address researcher,string title,bytes32[] criteria,bytes pubKey,uint32 consents,bool open))",
  "event PatientRegistered(address indexed patient, bytes32 root)",
  "event TrialClosed(uint256 indexed id)",
  "event TrialCreated(uint256 indexed id, address indexed researcher, string title)",
  "event Consented(uint256 indexed id, address indexed patient, bytes encContact)",
  "event Withdrawn(uint256 indexed id, address indexed patient)",
];

// Public reads use a plain RPC, so the site works (and serves from a CDN) before a wallet connects.
export const readOnly = () => new Contract(ADDRESS, ABI, new JsonRpcProvider(CHAIN.rpc));

export async function connect() {
  if (!window.ethereum) throw new Error("No wallet found. Install MetaMask, then reload.");
  // First request permission to access accounts (triggers MetaMask prompt)
  await window.ethereum.request({ method: "eth_requestAccounts" });
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN.hex }] });
  } catch (err) {
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: CHAIN.hex, chainName: CHAIN.name, rpcUrls: [CHAIN.rpc],
          nativeCurrency: { name: CHAIN.symbol, symbol: CHAIN.symbol, decimals: 18 }, blockExplorerUrls: [CHAIN.explorer] }],
      });
    } catch (addErr) {
      console.warn("Chain switch/add warning:", addErr);
    }
  }
  const signer = await new BrowserProvider(window.ethereum).getSigner();
  return { address: await signer.getAddress(), contract: new Contract(ADDRESS, ABI, signer) };
}

export { tagLeaf, buildTree, SEED_MESSAGE } from "./tree.mjs";
export const loadTree = (dump) => StandardMerkleTree.load(dump);
export const store = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const fetchStored = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
