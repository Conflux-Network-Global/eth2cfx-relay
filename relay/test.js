"use strict";

const { Conflux, util } = require("js-conflux-sdk");

const cfx = new Conflux({
  // url: 'http://testnet-jsonrpc.conflux-chain.org:12537',
  url: "http://localhost:3000",
  defaultGasPrice: 100, // The default gas price of your following transactions
  defaultGas: 1000000, // The default gas of your following transactions
  logger: console,
});

const test = async () => {
  let balance = await cfx.getBalance("0x11135d2fcd194785bceb223ad18a45fd66d27a7e");
  console.log(balance.toString(10));
  let epochNum = await cfx.getEpochNumber();
  console.log(epochNum);
}

test();
