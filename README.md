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
  - Relay converts calls to ETH calls to CFX calls (pre-processing)
  - Relay converts CFX responses to ETH responses (post-processing)

Commands

- `yarn start`: start up the relay
- `yarn test`: start tests (make sure to also start relay)

`.env` File Configuration:
```
ENDPOINT=http://test.confluxrpc.org
PORT=3000
```

## [Pre-Processing Functions](./utils/preprocess.js)

- Methods are converted from `eth_*` to `cfx_*` calls following the recommendations on the [Conflux documentation](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc#migrating-from-ethereum-json-rpc).
- The [ETH block parameter](https://eth.wiki/json-rpc/API#the-default-block-parameter) is converted to the [CFX epoch parameter](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc/#the-epoch-number-parameter).
- Certain methods that do not have complimentary `cfx_*` calls are custom built in the [index.js](./index.js) under the `customMethods()` function.

## [Post-Processing Functions](./utils/postprocess.js)

- Calls that involve getting block information (`getBlockByHash`, `getBlockBy(Epoch)Number`) have CFX parameters mapped to ETH parameters as follows: (any hard coded values do not have comparable equivalents)
  | ETH parameter | CFX parameter |
  | -- | -- |
  | sha3Uncles | keccak256(Buffer.from(refereeHashes)) |
  | stateRoot | deferredStateRoot |
  | receiptsRoot | deferredReceiptsRoot |
  | gasUsed | `0x0` |
  | extraData | `0x0` (32 bytes)|
  | uncles | `[]` |
  | number | height |
- Calls involving transaction information (`getBlockByHash`, `getBlockBy(Epoch)Number`, `getTransactionByHash`) have CFX parameters mapped to ETH parameters as follows:
  | ETH parameter | CFX parameter |
  | -- | -- |
  | input | data |
  | blockNumber | _see code for details_ |
- Calls involving receipt data (`getTransactionReceipt`) have CFX parameters mapped to ETH parameters as follows:
  | ETH parameter | CFX parameter |
  | -- | -- |
  | transactionIndex | index |
  | cumulativeGasUsed| gasUsed|
  | blockNumber | epochNumber |

## Improvements

- What other calls need to be converted/supported?
- Not all calls have test cases written
- Remove reliance on public node endpoint

## Resources

- [CFX JSON-RPC](https://developer.conflux-chain.org/docs/conflux-doc/docs/json_rpc/) - Conflux Documentation
- [ETH JSON-RPC](https://github.com/ethereum/wiki/wiki/JSON-RPC) - Ethereum Documentation
- [Jayson](https://github.com/tedeh/jayson) - simple JSON-RPC server
