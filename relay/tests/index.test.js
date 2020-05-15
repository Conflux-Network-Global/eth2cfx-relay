"use strict";

const { Conflux } = require("js-conflux-sdk");
const { abi } = require("./fcPartialABI.js");
const Web3 = require("web3");

//direct connection to conflux network
const cfx = new Conflux({
  url: "http://testnet-jsonrpc.conflux-chain.org:12537",
  // url: "http://localhost:3000",
  defaultGasPrice: 100, // The default gas price of your following transactions
  defaultGas: 1000000, // The default gas of your following transactions
  logger: console,
});

//instance to connect through relay (ETH calls)
const relay = new Web3("http://localhost:3000");

const user_address = "0x11135d2fcd194785bceb223ad18a45fd66d27a7e";
const fc_address = "0x88a8f9b1835ae66b6f1da3c930b7d11220bebf78";
const cfx_contract = cfx.Contract({ abi, address: fc_address });
const relay_contract = new relay.eth.Contract(abi, fc_address);

test("relay rejects unknown method", () => {
  expect(() => {
    relay.eth.getHashRate();
  }).toThrow();
});

test("gasPrice functions correctly for relay", async () => {
  const cfx_gas = await cfx.getGasPrice();
  const relay_gas = await relay.eth.getGasPrice();
  expect(cfx_gas.toString()).toBe(relay_gas.toString());
});

test("getBlockNumber functions correctly for relay", async () => {
  const cfx_epoch = await cfx.getEpochNumber();
  const relay_epoch = await relay.eth.getBlockNumber();
  expect(cfx_epoch).toBeLessThanOrEqual(relay_epoch); //because blocks are mined so quickly that the first call should have a earlier epoch than the next call
});

test("getBalance functions correctly for relay", async () => {
  const cfx_balance = await cfx.getBalance(user_address);
  const relay_balance = await relay.eth.getBalance(user_address);
  expect(cfx_balance.toString()).toBe(relay_balance.toString());
});

test("calling FC contract functions correctly for relay", async () => {
  const relay_balance = await relay_contract.methods.totalSupply().call();
  const cfx_balance = await cfx_contract.totalSupply();
  expect(relay_balance.toString()).toBe(cfx_balance.toString());
});

//issue with test cases is that the endpoint is not very fast so the test cases may timeout
