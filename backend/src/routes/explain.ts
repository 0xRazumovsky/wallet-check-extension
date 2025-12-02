import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { decodeCalldata, getAbi } from "../services/abi.js";
import { fetchBytecode, analyzeBytecode } from "../services/bytecode.js";
import { evaluateRisk } from "../services/heuristics.js";
import { lookupFourByte } from "../services/fourbyte.js";
import { gatherContractIntel } from "../services/contractIntel.js";
import {
  ExplainResult,
  type DecodedCall,
  type RiskResult,
  type ContractIntel,
} from "../types/index.js";

const router = Router();

const explainSchema = z.object({
  chainId: z.number(),
  to: z.string(),
  data: z.string(),
  value: z.string().optional(),
  from: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = explainSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.message });

  const { chainId, to, data } = parsed.data;

  try {
    const abiInfo = await getAbi(chainId, to);
    const signature = abiInfo?.abi ? null : await lookupFourByte(data);
    const decoded = decodeCalldata(data, abiInfo?.abi, signature?.name);

    const bytecode = await fetchBytecode(chainId, to);
    const bytecodeMeta = analyzeBytecode(bytecode, Boolean(abiInfo?.abi));
    const intel = await gatherContractIntel(chainId, to, abiInfo?.source);

    const risk = evaluateRisk({
      decoded,
      data,
      bytecodeMeta,
      abiAvailable: Boolean(abiInfo?.abi),
      intel,
    });

    const explanation = buildExplanation({ decoded, risk, intel });

    const result: ExplainResult = {
      decoded,
      bytecodeMeta,
      risk,
      explanation,
      intel,
      targetAddress: to,
      chainId,
    };
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Unable to explain transaction" });
  }
});

function buildExplanation({
  decoded,
  risk,
  intel,
}: {
  decoded: DecodedCall | null;
  risk: RiskResult;
  intel?: ContractIntel;
}): string {
  const action = decoded?.humanReadable || decoded?.method || "Unknown action";
  const topReasons = risk.reasons.slice(0, 2).map((r) => r.description);
  const ageText =
    intel?.ageDays !== null && intel?.ageDays !== undefined
      ? `Contract age: ${intel.ageDays} days.`
      : "";
  const labelText =
    intel?.labels?.length
      ? `Labels: ${intel.labels.map((l) => `${l.source}=${l.label}`).join(", ")}.`
      : "";
  const reasonText = topReasons.length
    ? `Key risks: ${topReasons.join("; ")}.`
    : "";
  return `Action: ${action}. Risk level ${risk.level} (score ${risk.score}). ${ageText} ${labelText} ${reasonText}`.trim();
}

export default router;
