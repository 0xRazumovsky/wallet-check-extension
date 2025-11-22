import { Interface, ParamType } from "ethers";
import { DecodedCall, DecodedParameter } from "../types/index.js";
import axios from "axios";

interface AbiCacheEntry {
  abi: any[];
  source: "sourcify" | "etherscan";
}

const abiCache = new Map<string, AbiCacheEntry>();
const SOURCIFY_BASE = "https://repo.sourcify.dev/contracts";

function cacheKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

async function fetchSourcifyAbi(chainId: number, address: string): Promise<any[] | null> {
  const lowered = address.toLowerCase();
  const urls = [
    `${SOURCIFY_BASE}/full_match/${chainId}/${lowered}/metadata.json`,
    `${SOURCIFY_BASE}/partial_match/${chainId}/${lowered}/metadata.json`
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 4000 });
      if (res.data?.output?.abi) {
        return res.data.output.abi;
      }
      if (res.data?.abi) return res.data.abi;
    } catch (err) {
      continue;
    }
  }
  return null;
}

function etherscanBase(chainId: number): string | null {
  const map: Record<number, string> = {
    1: "https://api.etherscan.io",
    5: "https://api-goerli.etherscan.io",
    11155111: "https://api-sepolia.etherscan.io"
  };
  return map[chainId] ?? null;
}

async function fetchEtherscanAbi(chainId: number, address: string): Promise<any[] | null> {
  const base = etherscanBase(chainId);
  if (!base) return null;
  const apiKey = process.env.ETHERSCAN_API_KEY ?? "";
  const url = `${base}/api?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
  try {
    const res = await axios.get(url, { timeout: 4000 });
    if (res.data?.status === "1" && res.data?.result) {
      const parsed = JSON.parse(res.data.result);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    return null;
  }
  return null;
}

export async function getAbi(chainId: number, address?: string) {
  if (!address) return null;
  const key = cacheKey(chainId, address);
  if (abiCache.has(key)) return abiCache.get(key)!;

  const sourcify = await fetchSourcifyAbi(chainId, address);
  if (sourcify) {
    const entry = { abi: sourcify, source: "sourcify" as const };
    abiCache.set(key, entry);
    return entry;
  }
  const etherscan = await fetchEtherscanAbi(chainId, address);
  if (etherscan) {
    const entry = { abi: etherscan, source: "etherscan" as const };
    abiCache.set(key, entry);
    return entry;
  }
  return null;
}

function formatParams(inputs: readonly ParamType[], args: readonly unknown[]): DecodedParameter[] {
  return inputs.map((input, idx) => ({
    name: input.name || `arg${idx}`,
    type: input.type,
    value: args[idx]
  }));
}

const knownSelectors: Record<string, string> = {
  "0xa9059cbb": "transfer(address,uint256)",
  "0x095ea7b3": "approve(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0x2e1a7d4d": "withdraw(uint256)",
  "0xd0e30db0": "deposit()",
  "0x41441d3b": "mint(address,uint256)",
  "0x9dc29fac": "burn(uint256)",
  "0x38ed1739": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)",
  "0x7ff36ab5": "swapExactETHForTokens(uint256,address[],address,uint256)",
  "0xac9650d8": "multicall(bytes[])"
};

export function inferSignatureFromData(data: string): string | undefined {
  if (!data || data === "0x" || data.length < 10) return undefined;
  const selector = data.slice(0, 10).toLowerCase();
  return knownSelectors[selector];
}

export function decodeCalldata(
  data: string,
  abi?: any[] | null,
  fallbackSignature?: string
): DecodedCall | null {
  if (!data || data === "0x") return null;
  if (abi && abi.length > 0) {
    try {
      const iface = new Interface(abi);
      const parsed = iface.parseTransaction({ data });
      if (!parsed) return null;
      return {
        method: parsed.name,
        signature: parsed.signature,
        params: formatParams(parsed.fragment.inputs, parsed.args),
        humanReadable: `${parsed.name}(${parsed.args.map((arg) => arg).join(", ")})`
      };
    } catch (err) {
      // fall through
    }
  }

  const signature = fallbackSignature ?? inferSignatureFromData(data);
  if (signature) {
    try {
      const iface = new Interface([`function ${signature}`]);
      const parsed = iface.parseTransaction({ data });
      if (!parsed) return null;
      return {
        method: parsed.name,
        signature,
        params: formatParams(parsed.fragment.inputs, parsed.args),
        humanReadable: `${parsed.name}(${parsed.args.map((arg) => arg).join(", ")})`
      };
    } catch (err) {
      // ignore
    }
  }

  return null;
}
