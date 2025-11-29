import { useMemo, useState } from "react";

type Reason = { id: string; level: string; score: number; description: string };
type ExplainResult = {
  decoded: { method?: string; humanReadable?: string } | null;
  risk: { score: number; level: "low" | "medium" | "high" | "critical"; reasons: Reason[] };
};

const scenarios: Record<string, ExplainResult> = {
  safe: {
    decoded: { method: "swapExactTokensForTokens", humanReadable: "Swap 100 USDC -> ETH" },
    risk: {
      score: 12,
      level: "low",
      reasons: [
        { id: "dex-router", level: "low", score: 8, description: "Known router call (Uniswap style)" },
        { id: "simple-transfer", level: "low", score: 4, description: "Simple token transfer" }
      ]
    }
  },
  warning: {
    decoded: { method: "approve", humanReadable: "Approve USDT unlimited for 0x...dead" },
    risk: {
      score: 62,
      level: "high",
      reasons: [
        { id: "infinite-approval", level: "high", score: 50, description: "Approval sets unlimited allowance" },
        { id: "unverified", level: "high", score: 45, description: "ABI unavailable; contract likely unverified" },
        { id: "proxy", level: "medium", score: 25, description: "Proxy pattern detected (EIP-1967)" }
      ]
    }
  },
  danger: {
    decoded: { method: "upgradeTo", humanReadable: "upgradeTo(0x...badc0de)" },
    risk: {
      score: 90,
      level: "critical",
      reasons: [
        { id: "delegatecall", level: "high", score: 50, description: "Contract uses delegatecall which can execute foreign code" },
        { id: "selfdestruct", level: "high", score: 50, description: "Contract can selfdestruct and remove code" },
        { id: "owner-privileged", level: "high", score: 45, description: "Owner/admin privileged function called" }
      ]
    }
  }
};

const badgeTone: Record<ExplainResult["risk"]["level"], string> = {
  low: "bg-emerald-900/50 text-emerald-200 ring-1 ring-emerald-500/40",
  medium: "bg-amber-900/50 text-amber-200 ring-1 ring-amber-500/40",
  high: "bg-orange-900/50 text-orange-200 ring-1 ring-orange-500/40",
  critical: "bg-red-900/50 text-red-200 ring-1 ring-red-500/40"
};

const levelCopy: Record<ExplainResult["risk"]["level"], string> = {
  low: "All clear — routine action",
  medium: "Caution — review the details",
  high: "High risk — double check",
  critical: "Danger — likely malicious"
};

export default function App() {
  const [data, setData] = useState<ExplainResult>(scenarios.warning);
  const [decision, setDecision] = useState<string | null>(null);
  const topReasons = useMemo(() => data.risk.reasons.slice(0, 4), [data]);

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400 uppercase tracking-[0.2em]">Preview</p>
            <h1 className="text-2xl font-semibold text-white">What Did I Just Sign? UI Frames</h1>
            <p className="text-slate-400 text-sm">Extension dashboard + transaction popup samples</p>
          </div>
          <div className="flex gap-2">
            {Object.keys(scenarios).map((key) => (
              <button
                key={key}
                className={`px-3 py-2 rounded-md text-sm font-medium border border-white/10 ${
                  data === scenarios[key] ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                }`}
                onClick={() => {
                  setDecision(null);
                  setData(scenarios[key]);
                }}
              >
                {key === "safe" ? "Safe" : key === "warning" ? "Warning" : "Danger"}
              </button>
            ))}
          </div>
        </header>

        <div className="grid gap-6 grid-cols-preview">
          <HomeFrame />
          <PopupFrame data={data} onDecision={setDecision} decision={decision} />
        </div>
      </div>
    </div>
  );
}

function HomeFrame() {
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-lg">🛡️</span> SafeTx Shield
          </div>
          <div className="text-xs text-slate-500">Your Web3 security companion</div>
        </div>
        <span className="text-[11px] text-slate-500">v1.0</span>
      </div>

      <section className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2">
        <div className="text-sm text-slate-300 font-medium flex items-center gap-2">
          <span>📊 Protection Stats</span>
          <span className="badge bg-emerald-900/60 text-emerald-200 ring-1 ring-emerald-500/30">Active</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
          <Stat label="Today" value="12 tx ✅" />
          <Stat label="Threats blocked" value="3 🛡️" />
          <Stat label="Saved" value="~$3,240" />
          <Stat label="Total tx" value="1,247" />
        </div>
      </section>

      <section className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-3">
        <div className="text-sm text-slate-300 font-medium">Quick Actions</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {["🔍 Check Address", "📋 Approve History", "🔔 Notifications", "⚙️ Settings"].map((action) => (
            <button
              key={action}
              className="border border-white/5 rounded-lg py-2 px-3 bg-white/5 text-slate-200 hover:bg-white/10 transition"
            >
              {action}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-300 font-medium">
          <span>🔗 Connected Wallets</span>
          <button className="text-[11px] text-slate-400 hover:text-slate-200">+ Add</button>
        </div>
        <div className="border border-white/5 rounded-lg p-3 bg-white/5 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <span>🦊 MetaMask</span>
            <span className="badge bg-emerald-900/50 text-emerald-200 ring-1 ring-emerald-500/30">Connected</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">0x742d...5b9c</div>
          <div className="text-xs text-slate-400">Balance: $12,450</div>
        </div>
        <div className="flex gap-3 text-xs text-slate-400">
          <a href="#" className="hover:text-slate-200">Docs</a>
          <a href="#" className="hover:text-slate-200">Discord</a>
          <a href="#" className="hover:text-slate-200">Twitter</a>
        </div>
      </section>
    </div>
  );
}

function PopupFrame({
  data,
  onDecision,
  decision
}: {
  data: ExplainResult;
  onDecision: (v: string) => void;
  decision: string | null;
}) {
  const level = data.risk.level;
  return (
    <div className="glass rounded-2xl p-5 space-y-4 border border-white/5">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Transaction analysis</div>
          <h2 className="text-xl font-semibold text-white">{data.decoded?.method || "Unknown action"}</h2>
          <p className="text-sm text-slate-400">{data.decoded?.humanReadable}</p>
        </div>
        <div className="text-right">
          <span className={`badge ${badgeTone[level]}`}>{level.toUpperCase()} • {data.risk.score}</span>
          <div className="text-xs text-slate-400 mt-1">{levelCopy[level]}</div>
        </div>
      </header>

      <div className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-3">
        <div className="text-sm text-slate-300 font-medium flex items-center gap-2">
          <span>⚠️ Key risks</span>
          <span className="text-[11px] text-slate-500">Top {Math.min(4, data.risk.reasons.length)}</span>
        </div>
        <div className="space-y-2 text-sm text-slate-200">
          {data.risk.reasons.length === 0 && <div className="text-slate-500 text-xs">No specific risks detected.</div>}
          {topFour(data.risk.reasons).map((reason) => (
            <div key={reason.id} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-slate-500" />
              <div>
                <div className="text-slate-200">{reason.description}</div>
                <div className="text-[11px] text-slate-500">{reason.level.toUpperCase()} • +{reason.score} pts</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-3">
        <div className="text-sm text-slate-300 font-medium">Actions</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <button
            className="bg-red-500/10 hover:bg-red-500/20 text-red-200 border border-red-500/30 rounded-lg py-3 font-semibold transition"
            onClick={() => onDecision("Blocked")}
          >
            🛡️ Block transaction
          </button>
          <button
            className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-lg py-3 font-semibold transition"
            onClick={() => onDecision("Proceed")}
          >
            ⚠️ I understand risks
          </button>
          <button className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg py-2 transition">
            📝 Report false positive
          </button>
          <button className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-lg py-2 transition">
            🔗 View on explorer
          </button>
        </div>
        {decision && <div className="text-xs text-slate-400">Decision: {decision}</div>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/5">
      <div className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function topFour(reasons: Reason[]) {
  return reasons.slice(0, 4);
}
