# Ethereum To Conflux Relay
Building a relay to convert [ETH JSON-RPC](https://github.com/ethereum/wiki/wiki/JSON-RPC) calls to [CFX JSON-RPC](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc/) calls.

Initial project specs and notes:
- Chainlink nodes have support for ETH commands built in
- Conflux nodes use slightly different function calls
- Similar ideas to Chainlink external adapters + interfacing with data sources
  - Using a relay as a "network adapter" to inferface with layer 1 protocols
- Using a JSON-RPC server as a relay
  - https://www.npmjs.com/package/jayson#using-the-server-as-a-relay
  - https://www.npmjs.com/package/jayson#method-routing
- Impact
  - A bridge for protocols that can interact with Ethereum to begin interacting with Conflux (not just limited to Chainlink)

Development steps (will be more clear as things move along):
1. Relay construction
   - Relay to send CFX calls onward to CFX node
   - Relay to take ETH calls and send CFX calls onward (needs more research)
   - Testing of calls (compare relayed calls with direct CFX calls)
1. Demonstrate capability of relay with Chainlink
   - Deploy simple oracle smart contract
   - Possibly deploying LINK tokens (can you disable it in the oracle contract + node?)
   - Starting a Chainlink node and connecting it
1. Build demo of DApp on Conflux leveraging information from Chainlink oracle
   - Custom external adapter (may be out of scope of demo)
   - Simple front-end for DApp

Current unknowns/risks:
- Can Conflux support all the necessary + equivalent ETH calls that a Chainlink node will need? (_biggest question_)
- How to get a Chainlink node to check for events? (CRON job?)
- How to view emitted events on Conflux? (this might not be difficult, but just unknown)

Resources
- [CFX JSON-RPC](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc/) - Conflux Documentation
- [ETH JSON-RPC](https://github.com/ethereum/wiki/wiki/JSON-RPC) - Ethereum Documentation
- [Jayson](https://github.com/tedeh/jayson) - simple JSON-RPC server
