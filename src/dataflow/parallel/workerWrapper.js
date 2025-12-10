const { workerData } = require("worker_threads");

if (workerData.fullPath.endsWith(".ts")) {
  require("ts-node").register();
}

module.exports = require(workerData.fullPath);
