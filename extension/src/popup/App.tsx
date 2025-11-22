import { useEffect, useMemo, useState } from "react";
import "./styles.css";

interface Reason {
  id: string;
  level: string;
  score: number;
  description: string;
}

interface ExplainResult {
  decoded: { method?: string; humanReadable?: string; signature?: string; params?: any[] } | null;
  bytecodeMeta: { isProxy?: boolean };
  risk: { score: number; level: string; reasons: Reason[] };
  explanation: string;
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("requestId");
    setRequestId(id);
    if (!id) return;
    chrome.runtime.sendMessage({ type: "POPUP_INIT", id }, (response) => {
      setData(response as ExplainResult);
      setLoading(false);
    });
  }, []);

  const topReasons = useMemo(() => data?.risk.reasons.slice(0, 2) ?? [], [data]);

  const decision = (choice: "proceed" | "abort") => {
    if (!requestId) return;
    chrome.runtime.sendMessage({ type: "POPUP_DECISION", id: requestId, decision: choice });
    window.close();
  };

  if (loading) {
    return (
      <div className="p-6 w-96 text-center">Loading transaction details...</div>
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
