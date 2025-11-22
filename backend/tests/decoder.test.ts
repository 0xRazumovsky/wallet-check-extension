import { describe, expect, it } from "vitest";
import { Interface } from "ethers";
import { decodeCalldata } from "../src/services/abi.js";

const iface = new Interface(["function transfer(address to,uint256 value)"]); 

describe("decodeCalldata", () => {
  it("decodes known selectors without ABI", () => {
    const data = iface.encodeFunctionData("transfer", [
      "0x000000000000000000000000000000000000dEaD",
      1000n
    ]);
    const decoded = decodeCalldata(data, null);
    expect(decoded?.method).toBe("transfer");
    expect(decoded?.params[0].name).toBe("to");
    expect(decoded?.params[1].value).toBe(1000n);
  });

  it("uses ABI when provided", () => {
    const decoded = decodeCalldata("0x", iface.fragments as any[]);
    expect(decoded).toBeNull();
  });
});
