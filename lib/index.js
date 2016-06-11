var readYaml = require('read-yaml');
var shelljs = require('shelljs');
var shelljs_global = require('shelljs/global');
var Web3 = require('web3');
var commander = require('commander');
var wrench = require('wrench');
var grunt = require('grunt');

var Blockchain = require('./blockchain.js');
var Deploy = require('./deploy.js');
var Release = require('./ipfs.js');
var Config = require('./config/config.js');
var ChainManager = require('./chain_manager.js');
var Test = require('./test.js');

Embark = {
  init: function() {
    this.blockchainConfig = (new Config.Blockchain());
    this.chainManager     = (new ChainManager());
  },

  startBlockchain: function(env, use_tmp) {
    var chain = new Blockchain(this.blockchainConfig.config(env));
    chain.startChain(use_tmp);
  },

  copyMinerJavascriptToTemp: function(){
    //TODO: better with --exec, but need to fix console bug first
    wrench.copyDirSyncRecursive(__dirname + "/../js", "/tmp/js", {forceDelete: true});
  },

  getStartBlockchainCommand: function(env, use_tmp) {
    var chain = new Blockchain(this.blockchainConfig.config(env));
    return chain.getStartChainCommand(use_tmp);
  },

  deployContracts: function(_web3, env, contractFiles, destFile, chainFile, withProvider, withChain, cb) {
    var gasPrice = this.blockchainConfig.gasPrice;
    var gasLimit = this.blockchainConfig.gasLimit;
    this.contractsConfig  = (new Config.Contracts(gasPrice, gasLimit, contractFiles, env));

    if (_web3 !== undefined) {
      this.web3 = _web3;
    } else {
      this.web3 = new Web3();

      try {
        this.web3.setProvider(new this.web3.providers.HttpProvider("http://" + this.blockchainConfig.rpcHost + ":" + this.blockchainConfig.rpcPort));
        primaryAddress = this.web3.eth.coinbase;
        this.web3.eth.defaultAccount = primaryAddress;
      } catch (e) {
        throw new Error("==== can't connect to " + this.blockchainConfig.rpcHost + ":" + this.blockchainConfig.rpcPort + " check if an ethereum node is running");
      }
    }

    this.chainManager.loadConfigFile(chainFile)
    this.chainManager.init(this.web3);

    var deploy = new Deploy(contractFiles, this.blockchainConfig.config(), this.contractsConfig, this.chainManager, withProvider, withChain, this.web3);
    deploy.deploy_contracts(function() {
      console.log("contracts deployed; generating abi file");
      var result = ""
      if (withProvider) {
        result += deploy.generate_provider_file(this.blockchainConfig.rpcHost, this.blockchainConfig.rpcPort);
      }
      result += deploy.generate_abi_file();
      cb(result);
    });
  },

  geth: function(env, args) {
    var chain = new Blockchain(this.blockchainConfig.config(env));
    chain.execGeth(args);
  },

  release: Release,

  initTests: function() {
    var embarkConfig = readYaml.sync("./embark.yml");
    var fileExpression = embarkConfig.contracts || ["app/contracts/**/*.sol", "app/contracts/**/*.se"];
    var contractFiles = grunt.file.expand(fileExpression);
    var blockchainFile = embarkConfig.blockchainConfig || 'config/blockchain.yml';
    var contractFile   = embarkConfig.contractsConfig  || 'config/contracts.yml';

    var tests = new Test(contractFiles, blockchainFile, contractFile, 'development');

    return tests;
  }
}

module.exports = Embark;
