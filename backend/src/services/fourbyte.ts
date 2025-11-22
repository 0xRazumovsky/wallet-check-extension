import axios from "axios";

interface FourByteResponse {
  count: number;
  results: Array<{ text_signature: string }>;
}

export async function lookupFourByte(data: string): Promise<{ name: string } | null> {
  if (!data || data.length < 10) return null;
  const selector = data.slice(0, 10);
  const url = `https://www.4byte.directory/api/v1/signatures/?hex_signature=${selector}`;
  try {
    const res = await axios.get<FourByteResponse>(url, { timeout: 4000 });
    const signature = res.data.results?.[0]?.text_signature;
    if (signature) return { name: signature };
  } catch (err) {
    return null;
  }
  return null;
}
