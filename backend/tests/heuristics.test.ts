import { describe, expect, it } from "vitest";
import { Interface } from "ethers";
import { evaluateRisk } from "../src/services/heuristics.js";
import { analyzeBytecode } from "../src/services/bytecode.js";

const approveIface = new Interface([
  "function approve(address spender,uint256 value)",
  "function upgradeTo(address newImplementation)"
]);

const maxUint = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("heuristics", () => {
  it("flags infinite approval", () => {
    const data = approveIface.encodeFunctionData("approve", [
      "0x000000000000000000000000000000000000dEaD",
      maxUint
    ]);
    const risk = evaluateRisk({
      decoded: {
        method: "approve",
        signature: "approve(address,uint256)",
        params: [
          { name: "spender", type: "address", value: "0x000000000000000000000000000000000000dEaD" },
          { name: "value", type: "uint256", value: maxUint }
        ],
        humanReadable: "approve(dead, max)"
      },
      data
    });
    const reason = risk.reasons.find((r) => r.id === "infinite-approval");
    expect(reason?.level).toBe("high");
    expect(risk.score).toBeGreaterThan(40);
  });

  it("detects proxy bytecode", () => {
    const proxyConstant = "360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const bytecode = `0x6080604052${proxyConstant}`;
    const meta = analyzeBytecode(bytecode);
    const risk = evaluateRisk({ decoded: null, data: "0x", bytecodeMeta: meta });
    expect(meta.isProxy).toBe(true);
    expect(risk.reasons.some((r) => r.id === "proxy")).toBe(true);
  });
});
