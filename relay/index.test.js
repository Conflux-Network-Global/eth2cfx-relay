"use strict";

const { Conflux } = require("js-conflux-sdk");

//direct connection to conflux network
const cfx = new Conflux({
  url: "http://mainnet-jsonrpc.conflux-chain.org:12537",
  defaultGasPrice: 100, // The default gas price of your following transactions
  defaultGas: 1000000, // The default gas of your following transactions
  logger: console,
});

//new instance to connect through relay
const relay = new Conflux({
  url: "http://localhost:3000",
  defaultGasPrice: 100, // The default gas price of your following transactions
  defaultGas: 1000000, // The default gas of your following transactions
  logger: console,
});

const userAddress = "0x11135d2fcd194785bceb223ad18a45fd66d27a7e";

test("getBalance functions correctly for relay", async () => {
  const cfx_balance = await cfx.getBalance(userAddress);
  const relay_balance = await relay.getBalance(userAddress);
  expect(cfx_balance.toString(10)).toBe(relay_balance.toString(10));
});

test("getEpochNumber functions correctly for relay", async () => {
  const cfx_epoch = await cfx.getEpochNumber();
  const relay_epoch = await relay.getEpochNumber();
  expect(cfx_epoch).toBeLessThanOrEqual(relay_epoch); //because blocks are mined so quickly that the first call should have a earlier epoch than the next call
});
