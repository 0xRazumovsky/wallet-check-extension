export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface DecodedParameter {
  name: string;
  type: string;
  value: unknown;
}

export interface DecodedCall {
  method: string;
  signature?: string;
  params: DecodedParameter[];
  humanReadable?: string;
}

export interface BytecodeMeta {
  opcodes: string[];
  byteLength: number;
  hasDelegatecall: boolean;
  hasSelfdestruct: boolean;
  isProxy: boolean;
  verified: boolean;
}

export interface RiskReason {
  id: string;
  score: number;
  level: "high" | "medium" | "low";
  description: string;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  reasons: RiskReason[];
}

export interface ExplainResult {
  decoded: DecodedCall | null;
  bytecodeMeta: BytecodeMeta;
  risk: RiskResult;
  explanation: string;
  intel: ContractIntel;
  targetAddress?: string;
  chainId?: number;
}

export type AbiSource = "sourcify" | "etherscan";

export interface IntelLabel {
  source: AbiSource;
  label: string;
  detail?: string;
}

export interface ContractIntel {
  labels: IntelLabel[];
  ageDays: number | null;
  createdAt: string | null;
  verified: boolean;
  abiSource: AbiSource | null;
}
