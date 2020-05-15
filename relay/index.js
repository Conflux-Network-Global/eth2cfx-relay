"use strict";

const jayson = require("jayson");
const cors = require("cors");
const connect = require("connect");
const jsonParser = require("body-parser").json;
const app = connect();

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
  eth_getLogs: "cfx_getLogs",
};

//note: some response/inputs structures are different...not sure how this will affect things yet
// getStorageAt has a different variable type for position
// estimateGas, blockByHash, blockByNumber have different return parameters
const methodFilter = (method) => eth2cfx[method];
const epochFilter = (params) => {
  if (params.length > 0) {
    const lastEntry = params[params.length - 1];
    if (lastEntry === "latest" || lastEntry === "pending") {
      params[params.length - 1] = "latest_state";
    }
  }
  return params;
};

const client = jayson.client.http(
  "http://mainnet-jsonrpc.conflux-chain.org:12537"
);

const methods = {
  //unknown method called (no corresponding method)
  no_method: function (args, callback) {
    var error = this.error(-32601); // returns an error with the default properties set
    callback(error);
  },
};

//using a router, all calls can be routed to the method rather than needing unique methods for each call
const router = {
  router: function (method, params) {
    method = methodFilter(method);
    params = epochFilter(params);

    return !method
      ? this._methods["no_method"]
      : new jayson.Method((args, callback) => {
          client.request(method, params, (err, response) => {
            console.log(method, params, err, response);
            err ? callback(err) : callback(err, response.result);
          });
        });
  },
};

// create a server
const server = jayson.server(methods, router);

app.use(cors());
app.use(jsonParser());
app.use(server.middleware());

// server.http().listen(3000);
app.listen(3000);
