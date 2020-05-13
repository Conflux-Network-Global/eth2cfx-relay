'use strict';

// const jayson = require('jayson');
//
// // create a client
// const client = jayson.client.http({
//   port: 3000
// });
//
// // invoke "add"
// client.request('add', [1, 1], function(err, response) {
//   if(err) throw err;
//   console.log(response.result); // 2
// });


const ConfluxWeb = require("conflux-web");
// const confluxWeb = new ConfluxWeb(
//   "http://testnet-jsonrpc.conflux-chain.org:12537"
// );
// const confluxWeb = new ConfluxWeb(
//   "http://mainnet-jsonrpc.conflux-chain.org:12537"
// );
const confluxWeb = new ConfluxWeb(
  "http://localhost:3000"
);

// confluxWeb.cfx.getEpochNumber().then(console.log);
confluxWeb.cfx
  .getBalance("0x11135d2fcd194785bceb223ad18a45fd66d27a7e")
  .then(console.log);
