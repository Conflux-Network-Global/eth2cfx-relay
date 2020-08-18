# Ethereum To Conflux Relay

**A bridge for protocols that can interact with Ethereum to begin interacting with Conflux without changing core code**

Note: Cannot relay signed transactions from ETH to CFX, only unsigned information.

## Technical Details

A relay to convert [ETH JSON-RPC](https://github.com/ethereum/wiki/wiki/JSON-RPC) calls to [CFX JSON-RPC](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc/) calls.

Project specs and notes:

- Conflux nodes use slightly different function calls that Ethereum JSON-RPC
- Using a JSON-RPC server as a relay
  - https://www.npmjs.com/package/jayson#using-the-server-as-a-relay
  - https://www.npmjs.com/package/jayson#method-routing
  - Relay converts calls to ETH calls to CFX calls

Commands

- `yarn start`: start up the relay
- `yarn test`: start tests (make sure to also start relay)

## Notes

- Calls that involve getting block information (`getBlockByHash` or `getBlockBy(Epoch)Number`) have CFX parameters mapped to ETH parameters as follows: (any hard coded values do not have comparable equivalents)
  | ETH parameter | CFX parameter |
  | -- | -- |
  | sha3Uncles | keccak256(Buffer.from(refereeHashes)) |
  | stateRoot | deferredStateRoot |
  | receiptsRoot | deferredReceiptsRoot |
  | gasUsed | `0x0` |
  | extraData | `0x0` (32 bytes)|
  | uncles | refereeHashes |

## Improvements

- What other calls need to be converted/supported?
- Not all calls have test cases written
- Remove reliance on public node endpoint

## Resources

- [CFX JSON-RPC](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc/) - Conflux Documentation
- [ETH JSON-RPC](https://github.com/ethereum/wiki/wiki/JSON-RPC) - Ethereum Documentation
- [Jayson](https://github.com/tedeh/jayson) - simple JSON-RPC server
