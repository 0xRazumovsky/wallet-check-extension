import { BigNumberish, formatUnits, toBigInt } from "ethers";
import { BytecodeMeta, ContractIntel, DecodedCall, RiskReason, RiskResult } from "../types/index.js";

export interface RiskContext {
  decoded: DecodedCall | null;
  data: string;
  bytecodeMeta?: BytecodeMeta;
  abiAvailable?: boolean;
  intel?: ContractIntel;
}

function pushReason(
  reasons: RiskReason[],
  condition: boolean,
  reason: RiskReason
): void {
  if (condition) reasons.push(reason);
}

function isMaxUint(value: unknown): boolean {
  try {
    const bigint = toBigInt(value as BigNumberish);
    return bigint === (toBigInt("0x" + "f".repeat(64)));
  } catch (err) {
    return false;
  }
}

function parseNumeric(value: unknown): bigint | null {
  try {
    return toBigInt(value as BigNumberish);
  } catch (err) {
    return null;
  }
}

function toReadableAmount(value: unknown, decimals = 18): string {
  const numeric = parseNumeric(value);
  if (numeric === null) return String(value);
  return formatUnits(numeric, decimals);
}

export function evaluateRisk(ctx: RiskContext): RiskResult {
  const reasons: RiskReason[] = [];
  const decoded = ctx.decoded;
  const bytecode = ctx.bytecodeMeta;
  const intel = ctx.intel;
  const ageDays = intel?.ageDays;

  const methodName = decoded?.method?.toLowerCase?.();
  const selector = ctx.data.slice(0, 10).toLowerCase();

  pushReason(
    reasons,
    methodName === "approve" &&
      decoded?.params?.[1] !== undefined &&
      isMaxUint(decoded.params[1].value),
    {
      id: "infinite-approval",
      score: 50,
      level: "high",
      description: "Approval sets unlimited allowance"
    }
  );

  pushReason(
    reasons,
    Boolean(methodName?.includes("owner") || methodName?.includes("admin")),
    {
      id: "owner-privileged",
      score: 45,
      level: "high",
      description: "Owner or admin privileged function called"
    }
  );

  pushReason(
    reasons,
    bytecode?.isProxy === true,
    {
      id: "proxy",
      score: 25,
      level: "medium",
      description: "Proxy pattern detected (EIP-1967)"
    }
  );

  pushReason(
    reasons,
    methodName === "mint" || methodName === "burn" || methodName === "burnfrom",
    {
      id: "mint-burn",
      score: 20,
      level: "medium",
      description: "Token mint/burn operation which is often privileged"
    }
  );

  pushReason(
    reasons,
    !decoded && ctx.data.length > 200,
    {
      id: "constructor",
      score: 20,
      level: "medium",
      description: "Calldata resembles contract deployment or constructor"
    }
  );

  const valueParam = decoded?.params?.find((p) => p.name === "value" || p.type?.includes("uint"));
  const valueReadable = valueParam ? toReadableAmount(valueParam.value) : null;

  pushReason(
    reasons,
    methodName === "transfer",
    {
      id: "simple-transfer",
      score: 5,
      level: "low",
      description: `Simple transfer${valueReadable ? ` of ${valueReadable}` : ""}`
    }
  );

  pushReason(
    reasons,
    Boolean(methodName?.includes("swap")) || selector === "0x38ed1739",
    {
      id: "dex-router",
      score: 8,
      level: "low",
      description: "Swap through router detected"
    }
  );

  pushReason(
    reasons,
    Boolean(ageDays !== null && ageDays !== undefined && ageDays < 30),
    {
      id: "age-30",
      score: 55,
      level: "high",
      description: `Contract is very new (${ageDays ?? "?"} days old)`
    }
  );

  pushReason(
    reasons,
    Boolean(ageDays !== null && ageDays !== undefined && ageDays >= 30 && ageDays < 60),
    {
      id: "age-60",
      score: 35,
      level: "medium",
      description: `Contract is relatively new (${ageDays ?? "?"} days old)`
    }
  );

  const flaggedLabels = intel?.labels?.filter((l) => l.detail || /scam|phish|hack|rug|exploit/i.test(l.label));
  const flaggedLabelText =
    flaggedLabels && flaggedLabels.length > 0
      ? flaggedLabels.map((l) => `${l.source}: ${l.label}`).join("; ")
      : "";
  pushReason(
    reasons,
    Boolean(flaggedLabels && flaggedLabels.length > 0),
    {
      id: "flagged-label",
      score: 70,
      level: "high",
      description: flaggedLabelText
        ? `Explorer labels suggest risk: ${flaggedLabelText}`
        : "Explorer labels suggest risk"
    }
  );

  const isApproval =
    methodName === "approve" ||
    methodName === "increaseallowance" ||
    methodName === "permit" ||
    selector === "0x095ea7b3";
  const spender = decoded?.params?.[0]?.value;
  const amount = decoded?.params?.[1]?.value ?? decoded?.params?.find((p) => p.name === "value")?.value;

  pushReason(
    reasons,
    isApproval,
    {
      id: "token-permission",
      score: 40,
      level: "medium",
      description: `This call grants spending rights${spender ? ` to ${spender}` : ""}${amount ? ` for ${toReadableAmount(amount)}` : ""}`
    }
  );

  const score = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.score, 0)));
  let level: RiskResult["level"] = "low";
  if (score > 85) level = "critical";
  else if (score > 60) level = "high";
  else if (score > 25) level = "medium";

  const sortedReasons = reasons.sort((a, b) => b.score - a.score);

  return { score, level, reasons: sortedReasons };
}
