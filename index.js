"use strict";

const jayson = require("jayson");
const cors = require("cors");
const connect = require("connect");
const jsonParser = require("body-parser").json;
const keccak256 = require("keccak256");
const app = connect();

//setting up the endpoint for CFX
const client = jayson.client.http(
  "http://mainnet-jsonrpc.conflux-chain.org:12537"
);

//currently supported eth calls with equivlanet cfx calls
const eth2cfx = {
  eth_gasPrice: "cfx_gasPrice",
  eth_blockNumber: "cfx_epochNumber",
  eth_getBalance: "cfx_getBalance",
  eth_getStorageAt: "cfx_getStorageAt",
  eth_getTransactionCount: "cfx_getNextNonce",
  eth_getCode: "cfx_getCode",
  eth_sendRawTransaction: "cfx_sendRawTransaction",
  eth_call: "cfx_call",
  eth_estimateGas: "cfx_estimateGasAndCollateral",
  eth_getBlockByHash: "cfx_getBlockByHash",
  eth_getBlockByNumber: "cfx_getBlockByEpochNumber",
  eth_getTransactionByHash: "cfx_getTransactionByHash",
  eth_getTransactionReceipt: "cfx_getTransactionReceipt",
  eth_getLogs: "cfx_getLogs" //caution about using cfx_getLogs (default fromEpoch is latest_checkpoint (earliest epoch in memory))
};

//note: some response/inputs structures are different...not sure how this will affect things yet
// getStorageAt has a different variable type for position
// estimateGas, blockByHash, blockByNumber have different return parameters

//get the corresponding cfx method based on the eth method
const methodFilter = method => {
  return method.includes("cfx_") ? method : eth2cfx[method];
};

//fixing the difference in epoch/block parameter
const epochFilter = params => {
  let newParams;
  if (params && params.length > 0) {
    newParams = params.map(param =>
      param == "latest" || param == "pending" ? "latest_state" : param
    );
  }
  return newParams;
};

//fixing potential that nonce is not 8-bytes (length 16)
//so far only seen on 1st block
const nonceFilter = response => {
  let nonce = response.result.nonce;
  if (nonce && nonce.length < 18) {
    //if nonce exists and too short (0x + 16 = 18)
    nonce = "0x" + "0".repeat(16 - nonce.length + 2) + nonce.slice(2);
    response.result.nonce = nonce;
  }
  return response;
};

//matching block data from eth_getBlockByNumber and cfx_getBlockByEpochNumber
const blockDataFilter = response => {
  response.result.sha3Uncles =
    "0x" +
    keccak256(Buffer.from(response.result.refereeHashes)).toString("hex");
  response.result.stateRoot = response.result.deferredStateRoot;
  response.result.receiptsRoot = response.result.deferredReceiptsRoot;
  response.result.gasUsed = "0x0"; //no gasUsed parameter from CFX response (replacing with 0)
  response.result.extraData = "0x" + "0".repeat(64); //no equivalent parameter
  response.result.uncles = response.result.refereeHashes;
  response.result.number = response.result.epochNumber;
  response.result.transactions = response.result.transactions.map(transaction =>
    transactionDataFilter(transaction)
  );
  return response;
};

//matching transaction data from CFX returned data to expected ETH data format
const transactionDataFilter = transactionData => {
  if (typeof transactionData === "object" && transactionData !== null) {
    //ignore if transactionData is null and not an object (occurs when getBlockBy* is called with false - only transaction hashes are presented)
    transactionData.input = transactionData.data;
  }
  return transactionData;
};

//matching receipt data from CFX to expected ETH data
const transactionReceiptFilter = receipt => {
  receipt.result.transactionIndex = receipt.result.index;
  receipt.result.cumulativeGasUsed = receipt.result.gasUsed;
  return receipt;
};

//creating a custom methods to handle methods that aren't directly supported
const customMethods = (unmatchedMethod, params) => {
  let output;
  switch (unmatchedMethod) {
    case "net_version": //ETH method for calling chainId
      output = (args, callback) => {
        let id;
        const host = client.options.hostname;
        id = host.includes("mainnet")
          ? 1
          : host.includes("testnet")
          ? 2
          : undefined;
        callback(null, id.toString());
      };
      break;
    default:
      output = (args, callback) => {
        var error = this.error(-32601); // returns an error with the default properties set
        callback(error);
      };
  }
  return output;
};

//using a router, all calls can be routed to the method rather than needing unique methods for each call
const router = {
  router: (method, params) => {
    //pre-process to convert
    console.log("INCOMING:", method, params);
    const matchedMethod = methodFilter(method);
    params = epochFilter(params);

    //return a method, one for no method found
    //the other for a method that queries the CFX endpoint based on the original data
    return !matchedMethod
      ? customMethods(method, params)
      : new jayson.Method((args, callback) => {
          console.log("TO CFX:", matchedMethod, params);
          client.request(matchedMethod, params, (err, response) => {
            //post-processing
            response = err ? response : nonceFilter(response); //apply filter for making sure nonce is correct format
            response = //implement filter if no error and the RPC call was for block data (getBlockBy*)
              !err && method.includes("getBlockBy")
                ? blockDataFilter(response)
                : response;
            response.result = //implement filter if no error and the RPC call was for transaction data (getTransactionByHash)
              !err && method.includes("getTransactionByHash")
                ? transactionDataFilter(response.result)
                : response.result;
            response = //implement filter if no error and the RPC call was for block data (getTransactionReceipt)
              !err && method.includes("getTransactionReceipt")
                ? transactionReceiptFilter(response)
                : response;
            console.log("RETURN:", matchedMethod, params, err, response);
            err ? callback(err) : callback(err, response.result);
          });
        });
  }
};

// create a middleware server for JSON RPC
const server = jayson.server(customMethods, router);

//create server with CORS handling
app.use(cors());
app.use(jsonParser());
app.use(server.middleware());
app.listen(3000, () => console.log(`ETH => CFX Relay is active on port 3000`));
