"use strict";

const jayson = require("jayson");
const cors = require("cors");
const connect = require("connect");
const jsonParser = require("body-parser").json;
const preprocess = require("./utils/preprocess");
const postprocess = require("./utils/postprocess");
const app = connect();

//setting up the endpoint for CFX
const client = jayson.client.http(
  "http://main.confluxrpc.org"
);

//creating a custom methods to handle methods that aren't directly supported
const customMethods = (unmatchedMethod, params) => {
  console.log("CUSTOM METHOD:", unmatchedMethod, params);
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
    case "eth_getTransactionByHash": //customized method for getTransactionByHash
      output = (args, callback) => {
        client.request("cfx_getTransactionByHash", args, (err, txResponse) => {
          if (!txResponse.error) {
            client.request(
              "cfx_getBlockByHash",
              [txResponse.result.blockHash, false],
              (err2, blockResponse) => {
                txResponse.result.epochNumber = blockResponse.result.epochNumber;
                txResponse = postprocess("cfx_getTransactionByHash", txResponse)
                callback(txResponse.error, txResponse.result);
              }
            );
          } else {
            callback(txResponse.error);
          }
        });
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
    let matchedMethod;
    [matchedMethod, params] = preprocess(method, params);

    //return a method, one for no method found
    //the other for a method that queries the CFX endpoint based on the original data
    return !matchedMethod
      ? customMethods(method, params)
      : new jayson.Method((args, callback) => {
          console.log("TO CFX:", matchedMethod, params);
          client.request(matchedMethod, params, (err, response) => {
            //post-processing
            response = err || response.error
              ? response
              : postprocess(method, params, response);
            console.log("RETURN:", matchedMethod, params, err, response);
            err ? callback(err) : callback(response.error, response.result);
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
