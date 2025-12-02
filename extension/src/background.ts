/// <reference types="chrome" />

interface ExplainPayload {
  chainId: number;
  to?: string;
  data: string;
  value?: string;
  from?: string;
}

interface IntelLabel {
  source: string;
  label: string;
  detail?: string;
}

interface Intel {
  labels: IntelLabel[];
  ageDays: number | null;
  createdAt: string | null;
  verified: boolean;
  abiSource: string | null;
}

interface ExplainResult {
  decoded: any;
  bytecodeMeta: any;
  risk: {
    score: number;
    level: string;
    reasons: Array<{ id: string; description: string; level: string; score: number }>;
  };
  explanation: string;
  intel: Intel;
  targetAddress?: string;
  chainId?: number;
}

const BACKEND_URL =
  (import.meta.env?.VITE_BACKEND_URL as string | undefined) || "http://localhost:4000";
const pendingDecisions = new Map<string, (decision: "proceed" | "abort") => void>();
const storedExplanations = new Map<string, ExplainResult>();
const WHITELIST_KEY = "wdijs_whitelist";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXPLAIN_REQUEST") {
    handleExplain(message.id as string, message.payload as ExplainPayload, sendResponse);
    return true;
  }

  if (message.type === "POPUP_INIT") {
    sendResponse(storedExplanations.get(message.id));
    return false;
  }

  if (message.type === "POPUP_DECISION") {
    pendingDecisions.get(message.id)?.(message.decision);
    pendingDecisions.delete(message.id);
    storedExplanations.delete(message.id);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "ADD_TO_WHITELIST") {
    addToWhitelist(message.address as string).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "IS_WHITELISTED") {
    isWhitelisted(message.address as string).then((value) => sendResponse({ whitelisted: value }));
    return true;
  }

  return false;
});

async function handleExplain(
  requestId: string,
  payload: ExplainPayload,
  sendResponse: (response: unknown) => void
) {
  try {
    const alreadyTrusted = await isWhitelisted(payload.to);
    if (alreadyTrusted) {
      sendResponse({ decision: "proceed", explain: null, whitelisted: true });
      return;
    }

    const explain = await callBackend(payload);
    const explainWithMeta: ExplainResult = { ...explain, targetAddress: payload.to, chainId: payload.chainId };
    storedExplanations.set(requestId, explainWithMeta);
    await openPopup(requestId);
    const decision = await waitForDecision(requestId);
    sendResponse({ decision, explain: explainWithMeta });
  } catch (err: any) {
    sendResponse({ decision: "proceed", error: String(err) });
  }
}

async function callBackend(payload: ExplainPayload): Promise<ExplainResult> {
  const res = await fetch(`${BACKEND_URL}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Backend error ${res.status}`);
  }
  return (await res.json()) as ExplainResult;
}

async function openPopup(requestId: string) {
  const url = chrome.runtime.getURL(`src/popup/index.html?requestId=${requestId}`);
  await chrome.windows.create({ url, type: "popup", width: 420, height: 560 });
}

function waitForDecision(requestId: string) {
  return new Promise<"proceed" | "abort">((resolve) => {
    pendingDecisions.set(requestId, resolve);
    setTimeout(() => {
      if (pendingDecisions.has(requestId)) {
        pendingDecisions.get(requestId)?.("proceed");
        pendingDecisions.delete(requestId);
      }
    }, 15000);
  });
}

async function getWhitelist(): Promise<Set<string>> {
  return new Promise((resolve) => {
    chrome.storage.local.get([WHITELIST_KEY], (result) => {
      const entries = (result?.[WHITELIST_KEY] as string[] | undefined) ?? [];
      resolve(new Set(entries.map((a) => a.toLowerCase())));
    });
  });
}

async function addToWhitelist(address?: string) {
  if (!address) return;
  const whitelist = await getWhitelist();
  whitelist.add(address.toLowerCase());
  return new Promise<void>((resolve) => {
    chrome.storage.local.set({ [WHITELIST_KEY]: Array.from(whitelist) }, () => resolve());
  });
}

async function isWhitelisted(address?: string): Promise<boolean> {
  if (!address) return false;
  const whitelist = await getWhitelist();
  return whitelist.has(address.toLowerCase());
}
