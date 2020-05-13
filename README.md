# Ethereum To Conflux Relay
Building a relay to convert [ETH JSON-RPC](https://github.com/ethereum/wiki/wiki/JSON-RPC) calls to [CFX JSON-RPC](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc/) calls.

Initial project specs and notes:
- Chainlink nodes have support for ETH commands built in
- Conflux nodes use slightly different function calls
- Similar ideas to Chainlink external adapters + interfacing with data sources
  - Using a relay as a "external adapter" to inferface with layer 1 protocols
- Using a JSON-RPC server as a relay
  - https://www.npmjs.com/package/jayson#using-the-server-as-a-relay
  - https://www.npmjs.com/package/jayson#method-routing
- Impact
  - A bridge for protocols that can interact with Ethereum to begin interacting with Conflux (not just limited to Chainlink)

Development steps (will be more clear as things move along):
1. Relay to send CFX calls onward to CFX node
1. Testing of calls (compare relayed calls with direct CFX calls)
1. Relay to take ETH calls and send CFX calls onward (needs more research)
1. Testing of calls (compare relayed calls with direct CFX calls)
1. Demonstrate capability of relay with Chainlink
  - Involves deploying oracle smart contracts
  - Possibly deploying LINK tokens (can you disable it in the oracle contract?)
