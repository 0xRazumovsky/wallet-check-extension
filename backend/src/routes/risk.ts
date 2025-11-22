import { Router } from "express";
import { z } from "zod";
import { analyzeBytecode } from "../services/bytecode.js";
import { evaluateRisk } from "../services/heuristics.js";
import { DecodedCall } from "../types/index.js";

const router = Router();

const riskSchema = z.object({
  chainId: z.number(),
  to: z.string().optional(),
  data: z.string(),
  decoded: z.any().optional(),
  bytecode: z.string().optional()
});

router.post("/", async (req, res) => {
  const parsed = riskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { data, decoded, bytecode } = parsed.data;
  const bytecodeMeta = bytecode ? analyzeBytecode(bytecode) : undefined;
  const risk = evaluateRisk({ decoded: (decoded as DecodedCall) ?? null, data, bytecodeMeta });

  return res.json({ risk });
});

export default router;
