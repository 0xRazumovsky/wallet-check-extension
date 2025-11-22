# What Did I Just Sign?

A full-stack MVP that intercepts Ethereum transactions in Chrome, decodes and explains calldata/bytecode, scores risk, and lets users confirm or abort before signing.

## Backend (Express + Ethers + Zod)
1. Install deps: `cd backend && npm install`
2. Dev server: `npm run dev` (defaults to `http://localhost:4000`)
3. Build: `npm run build` then `npm start`
4. Tests: `npm test`

Environment hints:
- `PORT`: backend port (default 4000)
- `RPC_URL` or `CHAIN_<ID>_RPC`: RPC endpoint for bytecode fetch
- `ETHERSCAN_API_KEY`: optional ABI fallback

## Extension (Vite + React + Tailwind)
1. Install deps: `cd extension && npm install`
2. Build: `npm run build` (outputs to `extension/dist`)
3. Load unpacked in Chrome: open `chrome://extensions`, enable Developer Mode, "Load unpacked" -> select `extension/dist`.
4. The extension intercepts `eth_sendTransaction`, calls the backend `/explain`, and shows a popup to Proceed/Abort.

## Example API Calls
- Decode: `curl -X POST http://localhost:4000/decode -H 'Content-Type: application/json' -d '{"chainId":1,"to":"0x...","data":"0x095ea7b300..."}'`
- Risk: `curl -X POST http://localhost:4000/risk -H 'Content-Type: application/json' -d '{"chainId":1,"data":"0x095ea7b3","decoded":null,"bytecode":"0x..."}'`
- Explain: `curl -X POST http://localhost:4000/explain -H 'Content-Type: application/json' -d '{"chainId":1,"to":"0x...","data":"0x095ea7b3"}'`

## Docker Compose
`cd infra && docker compose up` spins up the backend (dev mode), Redis (unused cache stub), and an Anvil RPC node.

## ASCII Architecture
```
Dapp page -> injected override -> content script -> background worker -> backend API
                                                          |-> heuristics/decoders
                                                          |-> RPC (bytecode)
                                                          |-> ABI sources (Sourcify/Etherscan)
Popup UI <- background <- backend response + risk score
```

## Project Notes
- All code is TypeScript; services are small and testable.
- Heuristics cover delegatecall, selfdestruct, proxies, mint/burn, infinite approvals, and more.
- Popup surfaces the top two risks with color-coded severity and lets users proceed or abort.
