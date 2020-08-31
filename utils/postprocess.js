const keccak256 = require("keccak256");

//post-processing function
module.exports = (method, params, response) => {
  let filtered;
  try {
    response = nonceFilter(response); //apply filter for making sure nonce is correct format
    if (method.includes("getBlockBy")) {
      //implement filter if the RPC call was for block data (getBlockBy*)
      filtered = blockDataFilter(response);
    } else if (method.includes("getTransactionByHash")) {
      //implement filter if the RPC call was for transaction data (getTransactionByHash)
      filtered = response;
      filtered.result = transactionDataFilter(
        response.result,
        response.result.epochNumber
      );
    } else if (method.includes("getTransactionReceipt")) {
      //implement filter if the RPC call was for block data (getTransactionReceipt)
      filtered = transactionReceiptFilter(response);
    } else if (method.includes("getLogs")) {
      //implement filter if the RPC call was for log data (getLogs)
      filtered = response;
      filtered.result = filtered.result.map((
        log //mapping parameters
      ) => logFilter(log, log.epochNumber, log.blockHash, log.transactionHash));
    } else {
      filtered = response;
    }
  } catch (e) {
    console.log("POSTPROCESS ERROR:", e);
    filtered = response;
  }
  return filtered;
};

//fixing potential that nonce is not 8-bytes (length 16)
//so far only seen on 1st block
const nonceFilter = response => {
  let nonce = response.result.nonce;
  if (nonce && nonce.length < 18) {
    //if nonce exists and too short (0x + 16 = 18)
    nonce = "0x" + "0".repeat(16 - nonce.length + 2) + nonce.slice(2);
    response.result.nonce = nonce;
  }
  return response;
};

//matching block data from eth_getBlockByNumber and cfx_getBlockByEpochNumber
const blockDataFilter = response => {
  response.result.sha3Uncles =
    "0x" +
    keccak256(Buffer.from(response.result.refereeHashes)).toString("hex");
  response.result.stateRoot = response.result.deferredStateRoot;
  response.result.receiptsRoot = response.result.deferredReceiptsRoot;
  response.result.gasUsed = "0x0"; //no gasUsed parameter from CFX response (replacing with 0)
  response.result.extraData = "0x" + "0".repeat(64); //no equivalent parameter
  // response.result.uncles = response.result.refereeHashes;
  response.result.uncles = [];
  response.result.number = response.result.epochNumber;
  response.result.transactions = response.result.transactions.map(transaction =>
    transactionDataFilter(transaction, response.result.epochNumber)
  );
  return response;
};

//matching transaction data from CFX returned data to expected ETH data format
const transactionDataFilter = (transactionData, epochNumber) => {
  if (typeof transactionData === "object" && transactionData !== null) {
    //ignore if transactionData is null and not an object (occurs when getBlockBy* is called with false - only transaction hashes are presented)
    transactionData.input = transactionData.data;
  }
  if (epochNumber !== null) {
    transactionData.blockNumber = epochNumber;
  }
  return transactionData;
};

//matching receipt data from CFX to expected ETH data
const transactionReceiptFilter = receipt => {
  receipt.result.transactionIndex = receipt.result.index;
  receipt.result.cumulativeGasUsed = receipt.result.gasUsed;
  receipt.result.blockNumber = receipt.result.epochNumber;
  receipt.result.logs = receipt.result.logs.map(log =>
    logFilter(
      log,
      receipt.result.epochNumber,
      receipt.result.blockHash,
      receipt.result.transactionHash
    )
  );
  return receipt;
};

//matching log data with expected ETH log data
const logFilter = (log, epochNumber, blockHash, txHash) => {
  log.blockNumber = epochNumber;
  log.blockHash = blockHash;
  log.transactionHash = txHash;
  return log;
};
