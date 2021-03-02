"use strict";

const jayson = require("jayson");
const WebSocket = require("ws");
require("dotenv").config();
const cors = require("cors");
const connect = require("connect");
const jsonParser = require("body-parser").json;
const preprocess = require("./utils/preprocess");
const postprocess = require("./utils/postprocess");

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

let client;

//check endpoint type ('ws' or 'ht')
const type = process.env.ENDPOINT.substring(0, 2);

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
                txResponse.result.epochNumber =
                  blockResponse.result.epochNumber;
                txResponse = postprocess(
                  "cfx_getTransactionByHash",
                  txResponse
                );
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
            response =
              err || response.error
                ? response
                : postprocess(method, params, response);
            console.log("RETURN:", matchedMethod, params, err, response);
            err ? callback(err) : callback(response.error, response.result);
          });
        });
  }
};

//logic for setting up server
if (type == "ht") {
  // create a middleware server for JSON RPC

  //setting up the endpoint for CFX
  client = jayson.client.http(process.env.ENDPOINT);
  const server = jayson.server(customMethods, router);
  const app = connect();

  //create server with CORS handling
  app.use(cors());
  app.use(jsonParser());
  app.use(server.middleware());
  app.listen(process.env.PORT, () =>
    console.log(
      `ETH => CFX JSON-RPC Relay is active on port ` + process.env.PORT
    )
  );
} else if (type == "ws") {
  // create a middleware server for websocket
  const wsRelay = new WebSocket.Server({ port: process.env.PORT });
  let wsNetwork = new WebSocket(process.env.ENDPOINT);
  console.log(
    `ETH => CFX Websocket Relay is active on port ` + process.env.PORT
  );

  //prevent endpoint from closing connection
  setInterval(() => {
    wsNetwork.ping(() => {});
  }, 30000);

  //handling if endpoint closes connection
  wsNetwork.on("close", function close() {
    "Endpoint closed connection please restart the relay";
  });

  let subscriptionIDs = {};
  let originalRequest = {};
  let requestIDMapping = {};

  //return to requester
  wsNetwork.on("message", function incoming(data) {
    console.log(`[proxy] incoming message: '${data}'`);

    // parse message
    try {
      data = JSON.parse(data);
    } catch (err) {
      console.error(`[proxy] failed to parse JSON\n    data: '${data.trim()}'\n    error: ${err}`);
      return;
    }

    if (data.method == "cfx_subscription") {
      // subscriptionIDs[data.params.subscription] = true;
      const dataObj = postprocess(
        data.method,
        subscriptionIDs[data.params.subscription].params,
        data.params
      );
      data.params = dataObj;
    }

    //only post process if no error (and is not a subscription response)
    if (!data.error && !!originalRequest[data.id]) {
      const inputs = originalRequest[data.id];
      data = postprocess(inputs.method, inputs.params, data);
    } else if (!data.error && !!subscriptionIDs[data.id]) {
      subscriptionIDs[data.result] = subscriptionIDs[data.id]; //setting subscription data to be looked up via subscription ID rather than request ID
      delete subscriptionIDs[data.id];
    }

    delete originalRequest[data.id];

    // get original request id and connection object
    const req = requestIDMapping[data.id];
    console.log(`[proxy] dispatching #${data.id} to client ${req.client_id} as #${req.id}`);
    data.id = req.id;

    data = JSON.stringify(data);
    console.log(`[${req.client_id}] result from node: '${data}'`)
    req.ws.send(data);
  });

  // handle WS client connection to relay information
  wsRelay.on("connection", function connection(ws) {
    const client_id = getRandomInt(10000, 90000);
    console.log(`[${client_id}] new connection`)

    ws.on("message", function incoming(data) {
      console.log(`[${client_id}] new client request: '${data.trim()}'`)

      // pass on to Conflux
      try {
        data = JSON.parse(data);
      } catch (err) {
        console.error(`[${client_id}] failed to parse JSON\n    data: '${data.trim()}'\n    error: ${err}`);
        return;
      }

      // not supporting newHeads pubSub
      if (data.method === "eth_subscribe" && data.params[0] === "newHeads") {
        data.method = "";
      }

      const [matchedMethod, params] = preprocess(data.method, data.params);
      data = { ...data, method: matchedMethod, params };

      // generate random request id so that we can handle multiple clients
      const newId = getRandomInt(10000, 1000000);
      console.log(`[${client_id}] assigning ID #${newId} to request #${data.id}`)
      requestIDMapping[newId] = { id: data.id, ws, client_id };
      data.id = newId;

      //saving data for post processing
      if (matchedMethod === "cfx_subscribe") {
        subscriptionIDs[data.id] = data;
      } else {
        originalRequest[data.id] = data;
      }

      data = JSON.stringify(data)
      console.log(`[${client_id}] sending request to Conflux: '${data}'`)
      wsNetwork.send(data);
    });

    //close all subscriptions when client closes connection
    ws.on("close", function close() {
      console.log(`[${client_id}] connection closed`)

      // Object.keys(subscriptionIDs).forEach(key => {
      //   wsNetwork.send(
      //     Buffer.from(
      //       JSON.stringify({
      //         jsonrpc: "2.0",
      //         method: "cfx_unsubscribe",
      //         params: [key],
      //         id: 2
      //       })
      //     )
      //   );
      // });
    });
  });
} else {
  console.log("Invalid endpoint in .env file");
}
