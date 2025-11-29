/// <reference types="chrome" />

interface ExplainPayload {
  chainId: number;
  to?: string;
  data: string;
  value?: string;
  from?: string;
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
}

const BACKEND_URL =
  (import.meta.env?.VITE_BACKEND_URL as string | undefined) || "http://localhost:4000";
const pendingDecisions = new Map<string, (decision: "proceed" | "abort") => void>();
const storedExplanations = new Map<string, ExplainResult>();

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

  return false;
});

async function handleExplain(
  requestId: string,
  payload: ExplainPayload,
  sendResponse: (response: unknown) => void
) {
  try {
    const explain = await callBackend(payload);
    storedExplanations.set(requestId, explain);
    await openPopup(requestId);
    const decision = await waitForDecision(requestId);
    sendResponse({ decision, explain });
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
