"use strict";

const jayson = require("jayson");
const cors = require("cors");
const connect = require("connect");
const jsonParser = require("body-parser").json;
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
  eth_getLogs: "cfx_getLogs",
};

//note: some response/inputs structures are different...not sure how this will affect things yet
// getStorageAt has a different variable type for position
// estimateGas, blockByHash, blockByNumber have different return parameters

//get the corresponding cfx method based on the eth method
const methodFilter = (method) => {
  return method.includes("cfx_") ? method : eth2cfx[method];
};

// //fixing the difference in epoch/block parameter
// const epochFilter = (params) => {
//   if (params && params.length > 0) {
//     const lastEntry = params[params.length - 1];
//     if (lastEntry === "latest" || lastEntry === "pending") {
//       params[params.length - 1] = "latest_state";
//     }
//   }
//   return params;
// };

//creating a method to handle methods that aren't supported
const methods = {
  //unknown method called (no corresponding method)
  no_method: function (args, callback) {
    var error = this.error(-32601); // returns an error with the default properties set
    callback(error);
  },
};

//using a router, all calls can be routed to the method rather than needing unique methods for each call
const router = {
  router: (method, params) => {
    //pre-process to convert
    console.log(method, params);
    // method = methodFilter(method);
    // params = epochFilter(params);

    //return a method, one for no method found
    //the other for a method that queries the CFX endpoint based on the original data
    return !method
      ? methods["no_method"]
      : new jayson.Method((args, callback) => {
          client.request(method, params, (err, response) => {
            console.log(method, params, err, response);
            err ? callback(err) : callback(err, response.result);
          });
        });
  },
};

// create a middleware server for JSON RPC
const server = jayson.server(methods, router);

//create server with CORS handling
app.use(cors());
app.use(jsonParser());
app.use(server.middleware());
app.listen(3000);
