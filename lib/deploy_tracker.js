var fs = require('fs');
var prettyJson = require("json-honey");

var DeployTracker = function(options) {
  this.logger = options.logger;
  this.env = options.env;
  this.chainConfig = options.chainConfig;
  this.web3 = options.web3;

  if (this.chainConfig === false) {
    this.currentChain = {contracts: []};
    return;
  }

  var block = this.web3.eth.getBlock(0);
  var chainId = block.hash;

  if (this.chainConfig[chainId] === undefined) {
    this.chainConfig[chainId] = {contracts: {}};
  }

  this.currentChain = this.chainConfig[chainId];

  this.currentChain.name = this.env;
  // TODO: add other params
  //this.currentChain.networkId = "";
  //this.currentChain.networkType = "custom"
};

DeployTracker.prototype.loadConfig = function(config) {
  this.chainConfig = config;
  return this;
};

DeployTracker.prototype.trackContract = function(contractName, code, args, address) {
  this.currentChain.contracts[this.web3.sha3(code + contractName + args.join(','))] = {
    name: contractName,
    address: address
  };
};

DeployTracker.prototype.getContract = function(contractName, code, args) {
  return this.currentChain.contracts[this.web3.sha3(code + contractName + args.join(','))];
};

// TODO: abstract this
// chainConfig can be an abstract PersistentObject
DeployTracker.prototype.save = function() {
  if (this.chainConfig === false) { return; }
  fs.writeFileSync("./chains.json", prettyJson(this.chainConfig));
};

module.exports = DeployTracker;

