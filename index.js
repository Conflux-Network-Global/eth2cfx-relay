"use strict";

const jayson = require("jayson");
const WebSocket = require("ws");
require("dotenv").config();
const cors = require("cors");
const connect = require("connect");
const jsonParser = require("body-parser").json;
const preprocess = require("./utils/preprocess");
const postprocess = require("./utils/postprocess");
const colors = require('colors');

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min);
}

function log(source, ...args) {
  console.log(`${new Date().toISOString()} -- [${source}]`.grey, ...args);
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

function parseRequest(raw) {
  const data = JSON.parse(raw);

  if (typeof data.id === 'undefined') {
    throw 'Invalid format: request missing "id" field';
  }

  if (typeof data.method === 'undefined') {
    throw 'Invalid format: request missing "method" field';
  }

  if (typeof data.params === 'undefined') {
    throw 'Invalid format: request missing "params" field';
  }

  return data;
}

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

  let requests = {};            // req id => promise
  let onSubNotification = {};   // sub id => callback
  let clientSubscriptions = {}; // client id => list

  // print stats regularly
  setInterval(() => {
    log('proxy', `stats: ${Object.keys(requests).length} requests / ${Object.keys(onSubNotification).length} subscriptions / ${Object.keys(clientSubscriptions).length} subscription clients`.grey);
  }, 1000)

  const response = (clientID, req, timeout) => {
    return new Promise((resolve, reject) => {
      requests[req.id] = (resp) => {
        delete requests[req.id];
        resolve(resp);
      };

      setTimeout(() => {
        if (typeof requests[req.id] !== 'undefined') {
          log(clientID, `no response within ${timeout}ms: ${JSON.stringify(req)}`.bgRed.white.bold);
          delete requests[req.id];
          reject();
        }
      }, timeout);
    });
  }

  const defaultHandler = (ctx) => {
    return (resp) => {
      if (!resp.error) {
        // post-process response
        resp = postprocess(ctx.req.method, ctx.req.params, resp);
      }

      // handle subscribe
      if (!resp.error && ctx.req.method === "cfx_subscribe") {
        const subID = resp.result;

        clientSubscriptions[ctx.clientID] = clientSubscriptions[ctx.clientID] || [];
        clientSubscriptions[ctx.clientID].push(subID);

        onSubNotification[subID] = (msg) => {
          const data = JSON.stringify(msg);
          log(ctx.clientID, `subscription notification:`, `'${data}'`.yellow)
          ctx.ws.send(data);
        };
      }

      // handle unsubscribe
      if (!resp.error && ctx.req.method === "cfx_unsubscribe" && resp.result) {
        const subID = ctx.req.params[0];
        clientSubscriptions[ctx.clientID] = clientSubscriptions[ctx.clientID].filter(e => e !== subID);
        delete onSubNotification[subID];
        log('proxy', `successfully unsubscribed client ${ctx.clientID} from #${subID}`);
      }

      log('proxy', `dispatching #${resp.id} to client ${ctx.clientID} as #${ctx.reqID}`);
      resp.id = ctx.reqID;

      const isError = !!resp.error;
      const data = JSON.stringify(resp);
      log(ctx.clientID, `result from node:`, isError ? `'${data}'`.red + ' (req: ' + `${JSON.stringify(ctx.req)}`.grey + ')' : `'${data}'`.green)
      ctx.ws.send(data);
    }
  }

  // handle WS client connection to relay information
  wsRelay.on("connection", (ws) => {
    // generate client ID
    const clientID = getRandomInt(10000, 90000);
    log(clientID, 'new connection');

    ws.on("message", async (raw) => {
      log(clientID, `new client request:`, `'${raw.trim()}'`.grey)

      // parse request
      let req;

      try {
        req = parseRequest(raw);
      } catch (err) {
        log(clientID, `failed to parse request\n    raw: '${raw.trim()}'\n    error: ${err}`.red);
        return;
      }

      // // not supporting newHeads pubSub
      // if (request.method === "eth_subscribe" && request.params[0] === "newHeads") {
      //   request.method = "";
      // }

      // pre-process request
      const [matchedMethod, params] = preprocess(req.method, req.params);
      req = { ...req, method: matchedMethod, params };





      /////////////////////
      if (req.method === 'cfx_getLogs') {
        const subreq = {
          jsonrpc: "2.0",
          method: "cfx_epochNumber",
          params: ["latest_state"],
          id: getRandomInt(10000, 1000000)
        };

        // send request
        const data = JSON.stringify(subreq)
        log(clientID, `sending request to Conflux: '${data}'`)
        wsNetwork.send(data);

        // wait for response
        let resp;
        try {
          resp = await response(clientID, subreq, 15000);
        } catch (err) {
          return;
        }

        const originalEpoch = parseInt(req.params[0].fromEpoch, 16);
        const latestEpoch = parseInt(resp.result, 16);

        const DAOEpoch = 15203231;

        // if (originalEpoch > latestEpoch) {
        //   log(clientID, `WARNING: rewriting "fromEpoch" from ${originalEpoch} (${req.params[0].fromEpoch}) to ${DAOEpoch} (0x${(DAOEpoch).toString(16)})`.bold.red);
        //   req.params[0].fromEpoch = `0x${(DAOEpoch).toString(16)}`;
        // }

        if (originalEpoch > latestEpoch) {
          log(clientID, `WARNING: rewriting "fromEpoch" from ${originalEpoch} (${req.params[0].fromEpoch}) to ${latestEpoch - 9500} (0x${(latestEpoch - 9500).toString(16)})`.bold.red);
          req.params[0].fromEpoch = `0x${(latestEpoch - 9500).toString(16)}`;
        }

        req.params[0].toEpoch = resp.result;
      }
      /////////////////////







      /////////////////////
      if (req.method === 'cfx_getLogs') {
        const fromEpoch = parseInt(req.params[0].fromEpoch, 16);
        const toEpoch = parseInt(req.params[0].toEpoch, 16);

        const MAX_GAP = 10000;

        let promises = [];

        if (toEpoch - fromEpoch >= MAX_GAP) {
          const operationID = getRandomInt(10000, 1000000);

          let from = fromEpoch;
          let to = Math.min(from + MAX_GAP - 1, toEpoch);

          while (from < toEpoch) {
            log(clientID, `cfx_getLogs[${operationID}]`, `requesting slice ${from}..${to} (from ${fromEpoch}..${toEpoch})`.bold.yellow);

            const subreq = {
              jsonrpc: "2.0",
              method: "cfx_getLogs",
              params: [{
                address: req.params[0].address,
                topics: req.params[0].topics,
                fromEpoch: `0x${from.toString(16)}`,
                toEpoch: `0x${to.toString(16)}`,
              }],
              id: getRandomInt(10000, 1000000)
            };

            // send request
            const data = JSON.stringify(subreq)
            log(clientID, `cfx_getLogs[${operationID}] sending request to Conflux: '${data}'`)
            wsNetwork.send(data);

            promises.push(response(clientID, subreq, 15000));

            from = to + 1;
            to = Math.min(from + MAX_GAP - 1, toEpoch);
          }

          let responses;
          let result = [];

          try {
            responses = await Promise.all(promises);
          } catch (err) {
            log(clientID, `cfx_getLogs[${operationID}]`, `operation failed`.bgRed.white.bold)
          }

          for (const resp of responses) {
            log(clientID, `cfx_getLogs[${operationID}] sub result:`, `${JSON.stringify(resp)}`.yellow.bold);

            if (resp.error) {
              const isError = !!resp.error;
              const data = JSON.stringify(resp);
              log(clientID, `cfx_getLogs[${operationID}] result from node:`, isError ? `'${data}'`.red + ' (req: ' + `${JSON.stringify(req)}`.grey + ')' : `'${data}'`.green)
              ws.send(data); // TODO: id
              return;
            }

            result = [...result, ...resp.result];
          }

          const resp = {
            jsonrpc: "2.0",
            result,
            id: req.id,
          };

          const data = JSON.stringify(resp);
          log(clientID, `cfx_getLogs[${operationID}] result from node:`, `'${data}'`.green)
          ws.send(data);
          return;
        }
      }
      /////////////////////






      // generate random request id so that we can handle multiple clients
      const reqID = req.id;
      req.id = getRandomInt(10000, 1000000);
      log(clientID, `assigning ID #${req.id} to request #${reqID}`)

      // send request
      const data = JSON.stringify(req)
      log(clientID, `sending request to Conflux:`, `'${data}'`.green)
      wsNetwork.send(data);

      // wait for response
      let resp;
      try {
        resp = await response(clientID, req, 15000);
      } catch (err) {
        return;
      }

      // handle response
      defaultHandler({ clientID, req, reqID, ws })(resp);
    });

    //close all subscriptions when client closes connection
    ws.on("close", async () => {
      log(clientID, `connection closed`)

      if (typeof clientSubscriptions[clientID] === 'undefined') {
        return;
      }

      const ids = clientSubscriptions[clientID];
      delete clientSubscriptions[clientID];

      for (const subID of ids) {
        const reqID = getRandomInt(10000, 1000000);

        const req = {
          jsonrpc: "2.0",
          method: "cfx_unsubscribe",
          params: [subID],
          id: reqID
        };

        const data = JSON.stringify(req)
        log(clientID, `sending request to Conflux:`, `'${data}'`.green)
        wsNetwork.send(data);

        let resp;
        try {
          resp = await response(clientID, req, 15000);
        } catch (err) {
          return;
        }

        if (!resp.result) {
          log('proxy', `unsubscribe failed for ${subID} on client ${clientID}`.red);
          return;
        }

        delete onSubNotification[subID];
        log('proxy', `successfully unsubscribed client ${clientID} from #${subID}`);
      }
    });
  });

  //return to requester
  wsNetwork.on("message", (raw) => {
    log('proxy', `incoming message:`, `'${raw}'`.grey);

    // parse message
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch (err) {
      log('proxy', `failed to parse JSON\n    raw: '${raw.trim()}'\n    error: ${err}`.red);
      return;
    }

    if (typeof msg.id !== 'undefined' && typeof requests[msg.id] !== 'undefined') {
      // treat as response
      return requests[msg.id](msg);
    }

    else if (msg.method === "cfx_subscription" && typeof msg.params.subscription !== 'undefined' && typeof onSubNotification[msg.params.subscription] !== 'undefined') {
      // treat as pubsub
      return onSubNotification[msg.params.subscription](msg);
    }

    else {
      log('proxy', `unexpected message: ${JSON.stringify(msg)}`.bgRed.white.bold)
      return;
    }
  });
} else {
  console.log("Invalid endpoint in .env file");
}
