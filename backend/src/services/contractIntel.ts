import axios from "axios";
import { AbiSource, ContractIntel, IntelLabel } from "../types/index.js";
import { etherscanBase } from "./abi.js";

const FLAGGED_KEYWORDS = [
  "phish",
  "hack",
  "scam",
  "rug",
  "exploit",
  "suspicious",
  "fake",
];

interface CreationInfo {
  ageDays: number | null;
  createdAt: string | null;
}

interface EtherscanIntel {
  labels: IntelLabel[];
  verified: boolean;
}

async function fetchCreationInfo(
  chainId: number,
  address: string
): Promise<CreationInfo> {
  const base = etherscanBase(chainId);
  if (!base) return { ageDays: null, createdAt: null };
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const url =
    `${base}/api?module=account&action=txlist&address=${address}` +
    `&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`;
  try {
    const res = await axios.get(url, { timeout: 5000 });
    if (
      res.data?.status !== "1" ||
      !Array.isArray(res.data?.result) ||
      res.data.result.length === 0
    ) {
      return { ageDays: null, createdAt: null };
    }
    const first = res.data.result[0];
    const ts = Number(first?.timeStamp);
    if (!Number.isFinite(ts)) return { ageDays: null, createdAt: null };
    const createdAt = new Date(ts * 1000);
    const ageMs = Date.now() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    return { ageDays, createdAt: createdAt.toISOString() };
  } catch {
    return { ageDays: null, createdAt: null };
  }
}

async function fetchEtherscanIntel(
  chainId: number,
  address: string
): Promise<EtherscanIntel> {
  const base = etherscanBase(chainId);
  if (!base) return { labels: [], verified: false };
  const apiKey = process.env.ETHERSCAN_API_KEY ?? "";
  const url = `${base}/api?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  try {
    const res = await axios.get(url, { timeout: 5000 });
    const entry = Array.isArray(res.data?.result) ? res.data.result[0] : null;
    if (!entry) return { labels: [], verified: false };

    const labels: IntelLabel[] = [];
    const contractName = (entry.ContractName as string | undefined)?.trim();
    const verified = Boolean(
      entry.ABI && entry.ABI !== "Contract source code not verified"
    );

    if (contractName && contractName.toLowerCase() !== "contract") {
      const lower = contractName.toLowerCase();
      const flagged = FLAGGED_KEYWORDS.filter((kw) => lower.includes(kw));
      labels.push({
        source: "etherscan",
        label: contractName,
        detail:
          flagged.length > 0
            ? `Flagged keywords: ${flagged.join(", ")}`
            : undefined,
      });
    }

    return { labels, verified };
  } catch {
    return { labels: [], verified: false };
  }
}

export async function gatherContractIntel(
  chainId: number,
  address?: string,
  abiSource?: AbiSource | null
): Promise<ContractIntel> {
  if (!address) {
    return {
      labels: [],
      ageDays: null,
      createdAt: null,
      verified: Boolean(abiSource ?? null),
      abiSource: abiSource ?? null,
    };
  }

  const [etherscan, creation] = await Promise.all([
    fetchEtherscanIntel(chainId, address),
    fetchCreationInfo(chainId, address),
  ]);

  const labels: IntelLabel[] = [...etherscan.labels];
  if (abiSource === "sourcify") {
    labels.push({ source: "sourcify", label: "Verified on Sourcify" });
  }
  if (abiSource === "etherscan" && !etherscan.verified) {
    labels.push({
      source: "etherscan",
      label: "ABI fetched but contract not verified",
    });
  }

  return {
    labels,
    ageDays: creation.ageDays,
    createdAt: creation.createdAt,
    verified: Boolean(abiSource) || etherscan.verified,
    abiSource: abiSource ?? null,
  };
}
