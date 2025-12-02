import axios from "axios";
import { BytecodeMeta } from "../types/index.js";

function rpcUrl(chainId: number): string {
  const envKey = process.env[`CHAIN_${chainId}_RPC`];
  if (envKey) return envKey;
  if (process.env.RPC_URL) return process.env.RPC_URL;
  const defaults: Record<number, string> = {
    1: "https://cloudflare-eth.com",
    5: "https://rpc.ankr.com/eth_goerli",
    11155111: "https://rpc.sepolia.org"
  };
  return defaults[chainId] || "https://cloudflare-eth.com";
}

export async function fetchBytecode(chainId: number, address: string): Promise<string> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getCode",
    params: [address, "latest"]
  };
  try {
    const res = await axios.post(rpcUrl(chainId), body, { timeout: 6000 });
    const code = res.data?.result ?? "0x";
    if (typeof code === "string") return code;
  } catch (err) {
    return "0x";
  }
  return "0x";
}

export function analyzeBytecode(bytecode: string, verified = false): BytecodeMeta {
  // Opcode analysis is disabled for now; keep structure for compatibility.
  const opcodes: string[] = [];
  const isProxy = bytecode.includes(
    "360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  );
  return {
    opcodes,
    byteLength: bytecode === "0x" ? 0 : (bytecode.length - 2) / 2,
    hasDelegatecall: opcodes.includes("DELEGATECALL"),
    hasSelfdestruct: opcodes.includes("SELFDESTRUCT"),
    isProxy,
    verified
  };
}
