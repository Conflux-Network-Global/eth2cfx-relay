"use strict";

const jayson = require("jayson");

const methods = {
  //single method where information is passed directly to the endpoint
  cfx: jayson.client.http(
    "http://mainnet-jsonrpc.conflux-chain.org:12537"
  ),
};

//using a router, all calls can be routed to the method rather than needing unique methods for each call
const router = {
  router: function(method, params) {
    console.log(method, params);
    return this._methods["cfx"]
  }
}

// create a server
const server = jayson.server(methods, router);

server.http().listen(3000);
