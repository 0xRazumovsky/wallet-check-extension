import { useEffect, useMemo, useState } from "react";
import "./styles.css";

interface Reason {
  id: string;
  level: string;
  score: number;
  description: string;
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
  decoded: { method?: string; humanReadable?: string; signature?: string; params?: any[] } | null;
  bytecodeMeta: { isProxy?: boolean };
  risk: { score: number; level: string; reasons: Reason[] };
  explanation: string;
  intel: Intel;
  targetAddress?: string;
  chainId?: number;
}

const badgeColor: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800"
};

export default function App() {
  const [data, setData] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [whitelisted, setWhitelisted] = useState(false);
  const [whitelistSaving, setWhitelistSaving] = useState(false);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("requestId");
    setRequestId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    chrome.runtime.sendMessage({ type: "POPUP_INIT", id }, (response) => {
      setData(response as ExplainResult);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!data?.targetAddress) return;
    chrome.runtime.sendMessage(
      { type: "IS_WHITELISTED", address: data.targetAddress },
      (response) => setWhitelisted(Boolean(response?.whitelisted))
    );
  }, [data?.targetAddress]);

  const topReasons = useMemo(() => data?.risk.reasons.slice(0, 2) ?? [], [data]);
  const labels = data?.intel?.labels ?? [];
  const ageText =
    data?.intel?.ageDays === null || data?.intel?.ageDays === undefined
      ? "Unknown age"
      : `${data.intel.ageDays} days`;
  const labelSummary =
    labels.length === 0
      ? "No labels reported by explorers"
      : labels.map((l) => `${l.source}: ${l.label}`).join(", ");
  const shortAddress = (addr?: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");

  const runDemo = async () => {
    setDemoError(null);
    setDemoLoading(true);
    try {
      const backend =
        (import.meta.env.VITE_BACKEND_URL as string | undefined) || "http://localhost:4000";
      const demoPayload = {
        chainId: 1,
        to: "0x000000000000000000000000000000000000dead",
        data:
          "0x095ea7b3000000000000000000000000000000000000000000000000000000000000beef" +
          "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        value: "0x0"
      };
      const res = await fetch(`${backend}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demoPayload)
      });
      if (!res.ok) throw new Error(`Backend responded ${res.status}`);
      const payload = (await res.json()) as ExplainResult;
      setData(payload);
    } catch (err: any) {
      setDemoError(err?.message ?? "Failed to run demo");
    } finally {
      setDemoLoading(false);
      setLoading(false);
    }
  };

  const addToWhitelist = () => {
    if (!data?.targetAddress || whitelistSaving) return;
    setWhitelistSaving(true);
    setWhitelistError(null);
    chrome.runtime.sendMessage(
      { type: "ADD_TO_WHITELIST", address: data.targetAddress },
      (response) => {
        setWhitelistSaving(false);
        if (chrome.runtime.lastError || response?.ok !== true) {
          setWhitelistError(chrome.runtime.lastError?.message || "Failed to save address");
          return;
        }
        setWhitelisted(true);
      }
    );
  };

  const decision = (choice: "proceed" | "abort") => {
    if (!requestId) return;
    chrome.runtime.sendMessage({ type: "POPUP_DECISION", id: requestId, decision: choice });
    window.close();
  };

  if (loading) {
    return <div className="p-6 w-96 text-center">Loading transaction details...</div>;
  }

  if (!requestId) {
    return (
      <div className="p-6 w-96 space-y-2 text-center text-slate-700">
        <div className="font-semibold">No transaction context</div>
        <div className="text-sm text-slate-500">
          Trigger the popup by sending a transaction in a dapp. The extension will pause it and show details here.
        </div>
        <div className="pt-2 space-y-2">
          <button
            className="w-full bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-60"
            onClick={runDemo}
            disabled={demoLoading}
          >
            {demoLoading ? "Running demo..." : "Run demo explain"}
          </button>
          {demoError && <div className="text-xs text-red-600">{demoError}</div>}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 w-96 text-center text-red-600">
        Could not load transaction details.
      </div>
    );
  }

  return (
    <div className="p-5 w-96 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{data.decoded?.method || "Unknown action"}</h1>
          <p className="text-sm text-slate-600">{data.decoded?.humanReadable || data.explanation}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeColor[data.risk.level] || badgeColor.low}`}>
          {data.risk.level.toUpperCase()} • {data.risk.score}
        </span>
      </div>

      {data.targetAddress && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-slate-800">Contract {shortAddress(data.targetAddress)}</div>
            <button
              className={`px-2 py-1 rounded-md text-[11px] font-semibold ${whitelisted ? "bg-green-100 text-green-700" : "bg-slate-900 text-white hover:bg-slate-800"}`}
              onClick={addToWhitelist}
              disabled={whitelisted || whitelistSaving}
            >
              {whitelisted ? "Whitelisted" : whitelistSaving ? "Saving..." : "Trust address"}
            </button>
          </div>
          <div>{ageText} • ABI {data.intel?.abiSource ?? "unknown"} • {data.intel?.verified ? "verified" : "unverified"}</div>
          <div className="text-slate-500">{labelSummary}</div>
          {whitelistError && <div className="text-red-600">{whitelistError}</div>}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 space-y-2">
        <h2 className="text-sm font-medium text-slate-700">Top risks</h2>
        {topReasons.length === 0 && <p className="text-xs text-slate-500">No specific risks detected.</p>}
        {topReasons.map((reason) => (
          <div key={reason.id} className="text-xs text-slate-800 flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" /> {reason.description}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-md text-sm font-medium"
          onClick={() => decision("abort")}
        >
          Abort
        </button>
        <button
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-md text-sm font-medium"
          onClick={() => decision("proceed")}
        >
          Proceed
        </button>
      </div>
    </div>
  );
}
