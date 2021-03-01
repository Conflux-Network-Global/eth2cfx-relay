//preprocessing function
module.exports = (method, params) => {
  return [methodFilter(method), epochFilter(method, params)];
};

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
  // eth_getTransactionByHash: "cfx_getTransactionByHash", //custom handler created for getTransactionByHash (see index.js)
  eth_getTransactionReceipt: "cfx_getTransactionReceipt",
  eth_getLogs: "cfx_getLogs", //caution about using cfx_getLogs (default fromEpoch is latest_checkpoint (earliest epoch in memory))
  eth_subscribe: "cfx_subscribe"
};

//get the corresponding cfx method based on the eth method
const methodFilter = method => {
  return method.includes("cfx_") ? method : eth2cfx[method];
};

//fixing the difference in epoch/block parameter
const epochFilter = (method, params) => {
  let newParams;
  if (params && params.length > 0 && method !== "eth_getLogs" && method !== "eth_subscribe") {
    newParams = params.map(param =>
      param == "latest" || param == "pending" ? "latest_state" : param
    );
  } else if (method === "eth_getLogs" || (method === "eth_subscribe" && params[0] === "logs")) {
    //converting parameters in eth_getLogs
    let logFilter = params[0];
    if (method === "eth_subscribe") {
      logFilter = params[1];
    }

    if (logFilter.fromBlock) { //converting fromBlock to fromEpoch
      logFilter.fromEpoch = epochLogFilter(logFilter.fromBlock)
      delete logFilter.fromBlock;
    } else {
      logFilter.fromEpoch = "latest_state"
    }

    if (logFilter.toBlock) {//converting toBlock to toEpoch
      logFilter.toEpoch = epochLogFilter(logFilter.toBlock)
      delete logFilter.toBlock;
    }

    //////////////////
    if (logFilter.fromEpoch == '0x125b609') {
      // logFilter.fromEpoch = '0xE7FB5F';
      logFilter.fromEpoch = '0xEA356F';
    }

    if (logFilter.fromEpoch == '0x1284636') {
      // logFilter.fromEpoch = '0xE7FB5F';
      logFilter.fromEpoch = '0xEA4DDB';
    }

    if (logFilter.fromEpoch == '0x1287505') {
      // logFilter.fromEpoch = '0xE7FB5F';
      logFilter.fromEpoch = '0xEA74CC';
    }

    if (logFilter.fromEpoch == '0x12a9763') {
      logFilter.fromEpoch = '0xEC4BD9';
    }

    if (logFilter.fromEpoch == '0x12b489b') {
      logFilter.fromEpoch = '0xECD930';
    }

    if (logFilter.fromEpoch == '0x12cf11b') {
      logFilter.fromEpoch = '0xEE2B92';
    }

    if (logFilter.fromEpoch == '0x12cf2b5') {
      logFilter.fromEpoch = '0xEE2B92';
    }

    if (logFilter.fromEpoch == '0x12d8e68') {
      logFilter.fromEpoch = '0xEEA71C';
    }
    //////////////////

    if (method === "eth_subscribe") {
      newParams = [params[0], logFilter];
    } else {
      newParams = [logFilter];
    }
  }
  return newParams;
};

//converting to/from according to expected ETH JSON-RPC behavior
const epochLogFilter = (block) => {
  let epoch;
  if (Number(block) || block === "earliest") {
    epoch = block;
  } else {
    epoch = "latest_state";
  }
  return epoch
}
