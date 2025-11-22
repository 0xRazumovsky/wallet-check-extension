import { formatUnits, toBigInt } from "ethers";
function pushReason(reasons, condition, reason) {
    if (condition)
        reasons.push(reason);
}
function isMaxUint(value) {
    try {
        const bigint = toBigInt(value);
        return bigint === (toBigInt("0x" + "f".repeat(64)));
    }
    catch (err) {
        return false;
    }
}
function parseNumeric(value) {
    try {
        return toBigInt(value);
    }
    catch (err) {
        return null;
    }
}
function toReadableAmount(value, decimals = 18) {
    const numeric = parseNumeric(value);
    if (numeric === null)
        return String(value);
    return formatUnits(numeric, decimals);
}
export function evaluateRisk(ctx) {
    const reasons = [];
    const decoded = ctx.decoded;
    const bytecode = ctx.bytecodeMeta;
    const methodName = decoded?.method?.toLowerCase?.();
    const selector = ctx.data.slice(0, 10).toLowerCase();
    pushReason(reasons, methodName === "approve" &&
        decoded?.params?.[1] !== undefined &&
        isMaxUint(decoded.params[1].value), {
        id: "infinite-approval",
        score: 50,
        level: "high",
        description: "Approval sets unlimited allowance"
    });
    pushReason(reasons, bytecode?.hasDelegatecall === true, {
        id: "delegatecall",
        score: 50,
        level: "high",
        description: "Contract uses delegatecall which can execute foreign code"
    });
    pushReason(reasons, bytecode?.hasSelfdestruct === true, {
        id: "selfdestruct",
        score: 50,
        level: "high",
        description: "Contract can selfdestruct and remove code"
    });
    pushReason(reasons, !ctx.abiAvailable && (bytecode?.opcodes.length ?? 0) > 0, {
        id: "unverified",
        score: 45,
        level: "high",
        description: "ABI unavailable; contract likely unverified"
    });
    pushReason(reasons, Boolean(methodName?.includes("owner") || methodName?.includes("admin")), {
        id: "owner-privileged",
        score: 45,
        level: "high",
        description: "Owner or admin privileged function called"
    });
    pushReason(reasons, bytecode?.isProxy === true, {
        id: "proxy",
        score: 25,
        level: "medium",
        description: "Proxy pattern detected (EIP-1967)"
    });
    pushReason(reasons, methodName === "mint" || methodName === "burn" || methodName === "burnfrom", {
        id: "mint-burn",
        score: 20,
        level: "medium",
        description: "Token mint/burn operation which is often privileged"
    });
    pushReason(reasons, !decoded && ctx.data.length > 200, {
        id: "constructor",
        score: 20,
        level: "medium",
        description: "Calldata resembles contract deployment or constructor"
    });
    const valueParam = decoded?.params?.find((p) => p.name === "value" || p.type?.includes("uint"));
    const valueReadable = valueParam ? toReadableAmount(valueParam.value) : null;
    pushReason(reasons, methodName === "transfer", {
        id: "simple-transfer",
        score: 5,
        level: "low",
        description: `Simple transfer${valueReadable ? ` of ${valueReadable}` : ""}`
    });
    pushReason(reasons, Boolean(methodName?.includes("swap")) || selector === "0x38ed1739", {
        id: "dex-router",
        score: 8,
        level: "low",
        description: "Swap through router detected"
    });
    const score = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.score, 0)));
    let level = "low";
    if (score > 85)
        level = "critical";
    else if (score > 60)
        level = "high";
    else if (score > 25)
        level = "medium";
    const sortedReasons = reasons.sort((a, b) => b.score - a.score);
    return { score, level, reasons: sortedReasons };
}
