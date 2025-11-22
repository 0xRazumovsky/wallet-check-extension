import { Router } from "express";
import { z } from "zod";
import { decodeCalldata, getAbi } from "../services/abi.js";
import { lookupFourByte } from "../services/fourbyte.js";
const router = Router();
const decodeSchema = z.object({
    chainId: z.number(),
    to: z.string().optional(),
    data: z.string()
});
router.post("/", async (req, res) => {
    const parsed = decodeSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
    }
    const { chainId, to, data } = parsed.data;
    try {
        const abiInfo = await getAbi(chainId, to);
        const fourByte = abiInfo?.abi ? null : await lookupFourByte(data);
        const decoded = decodeCalldata(data, abiInfo?.abi, fourByte?.name);
        return res.json({ decoded, abiSource: abiInfo?.source ?? null, signature: fourByte?.name ?? null });
    }
    catch (err) {
        return res.status(500).json({ error: "Failed to decode" });
    }
});
export default router;
