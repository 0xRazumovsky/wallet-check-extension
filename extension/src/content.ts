/// <reference types="chrome" />

const INJECTED_FLAG = "__wdijs_injected";

if (!(window as any)[INJECTED_FLAG]) {
  (window as any)[INJECTED_FLAG] = true;
  injectInterceptor();
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = (event.data || {}) as any;
  if (data?.source !== "wdijs-page") return;

  chrome.runtime.sendMessage(
    {
      type: "EXPLAIN_REQUEST",
      id: data.requestId,
      payload: data.payload
    },
    (response) => {
      const decision = response?.decision ?? "proceed";
      window.postMessage({
        source: "wdijs-extension",
        requestId: data.requestId,
        decision,
        explanation: response?.explain
      }, "*");
    }
  );
});

function injectInterceptor() {
  const script = document.createElement("script");
  script.textContent = `(${pageInterceptor.toString()})();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function pageInterceptor() {
  const provider: any = (window as any).ethereum;
  if (!provider || !provider.request) return;
  const originalRequest = provider.request.bind(provider);
  const pending = new Map<string, (decision: string) => void>();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = (event.data || {}) as any;
    if (data?.source !== "wdijs-extension" || !pending.has(data.requestId)) return;
    pending.get(data.requestId)?.(data.decision);
    pending.delete(data.requestId);
  });

  provider.request = async (args: any) => {
    if (!args || typeof args.method !== "string") {
      return originalRequest(args);
    }

    if (args.method === "eth_signTypedData" || args.method === "eth_signTypedData_v4") {
      return originalRequest(args);
    }

    if (args.method === "eth_sendTransaction") {
      const tx = Array.isArray(args.params) ? args.params[0] : args.params;
      const chainHex = await originalRequest({ method: "eth_chainId" }).catch(() => null);
      const chainId = chainHex ? parseInt(chainHex, 16) : undefined;
      const requestId = crypto.randomUUID();
      const payload = {
        chainId: chainId ?? 1,
        to: tx?.to,
        data: tx?.data || "0x",
        value: tx?.value || "0x0",
        from: tx?.from
      };

      const decision = await new Promise<string>((resolve) => {
        pending.set(requestId, resolve);
        window.postMessage({ source: "wdijs-page", requestId, payload }, "*");
      });

      if (decision === "abort") {
        throw new Error("Transaction aborted by What Did I Just Sign?");
      }
    }

    return originalRequest(args);
  };
}
