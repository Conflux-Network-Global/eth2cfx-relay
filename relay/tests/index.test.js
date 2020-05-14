"use strict";

const { Conflux } = require("js-conflux-sdk");
const { abi } = require("./fcPartialABI.js");

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

const user_address = "0x11135d2fcd194785bceb223ad18a45fd66d27a7e";
const fc_address = "0x88a8f9b1835ae66b6f1da3c930b7d11220bebf78";
const cfx_contract = cfx.Contract({ abi, address: fc_address });
const relay_contract = relay.Contract({ abi, address: fc_address });

test("getBalance functions correctly for relay", async () => {
  const cfx_balance = await cfx.getBalance(user_address);
  const relay_balance = await relay.getBalance(user_address);
  expect(cfx_balance.toString(10)).toBe(relay_balance.toString(10));
});

test("getEpochNumber functions correctly for relay", async () => {
  const cfx_epoch = await cfx.getEpochNumber();
  const relay_epoch = await relay.getEpochNumber();
  expect(cfx_epoch).toBeLessThanOrEqual(relay_epoch); //because blocks are mined so quickly that the first call should have a earlier epoch than the next call
});

test("calling FC contract functions correctly for relay", async () => {
  const relay_balance = await relay_contract.totalSupply();
  const cfx_balance = await cfx_contract.totalSupply();
  expect(relay_balance.toString()).toBe(cfx_balance.toString());
});

//issue with test cases is that the endpoint is not very fast so the test cases may timeout
