var readYaml = require('read-yaml');
var fs = require('fs');
var toposort = require('toposort');
var Compiler = require('./../compiler.js');

ContractsConfig = function(gasPrice, gasLimit, files, env) {
  this.gasPrice = gasPrice;
  this.gasLimit = gasLimit;
  this.compiler = (new Compiler());
  this.all_contracts = [];
  this.contractDB = {};
  this.contractFiles = files;
  this.contractDependencies = {};
  this.contractStubs = {};
  this.env = env;
};

ContractsConfig.prototype.loadConfigFile = function(filename) {
  try {
    this.contractConfig = readYaml.sync(filename);
  } catch (e) {
    throw new Error("error reading " + filename);
  }
  return this;
};

ContractsConfig.prototype.loadConfig = function(config) {
  this.contractConfig = config;
  return this;
};

ContractsConfig.prototype.config = function() {
  return this.contractConfig[this.env];
};

ContractsConfig.prototype.is_a_interface = function(target, className) {

  if (this.contractStubs[className] && this.contractStubs[className].indexOf(target) >= 0)
     return true;  
  return false;
};

ContractsConfig.prototype.compileContracts = function() {
  var contractFile, source, j, className;
  var contractsConfig = this.config();

  // determine dependencies
  if (contractsConfig !== null) {
    for (className in contractsConfig) {
      options = contractsConfig[className];
      if (options.args == null) continue;

      ref = options.args; //get arguments
      for (j = 0; j < ref.length; j++) {
        arg = ref[j];
        if (arg[0] === "$") { //check if they are a contract dependency
          if (this.contractDependencies[className] === void 0) {
            this.contractDependencies[className] = [];
          }
          this.contractDependencies[className].push(arg.substr(1));
        }
      }

      this.contractStubs[className] = options.stubs;
    }
  }


  compiled_contracts = this.compiler.compile(this.contractFiles); //compile and push to contract DB

  for (className in compiled_contracts) {

    if (this.is_a_interface(className, compiled_contracts)) {
      continue;
    }

    this.all_contracts.push(className);
    this.contractDB[className] = {
      args: [],
      types: ['file'],
      gasPrice: this.gasPrice,
      gasLimit: this.gasLimit,
      compiled: compiled_contracts[className]
    };
  }

  this.configureContractsParameters(contractsConfig);

  this.sortContracts();
};

ContractsConfig.prototype.configureContractsParameters = function(contractsConfig) {
  for(var className in contractsConfig) {
    var contractConfig = contractsConfig[className];

    var contract;
    contract = this.contractDB[className];
    if (contract === undefined) {
      contract = {
        args: [],
        types: ['file'],
        gasPrice: this.gasPrice,
        gasLimit: this.gasLimit,
        compiled: contract
      };
      this.contractDB[className] = contract;
    }

    contract.gasPrice = contractConfig.gas_price || contract.gasPrice;
    contract.gasLimit = contractConfig.gas_limit || contract.gasLimit;
    contract.args     = contractConfig.args      || [];
    contract.address  = contractConfig.address;
    contract.onDeploy = contractConfig.onDeploy  || [];

    if (contractConfig.instanceOf !== undefined) {
      contract.types.push('instance');
      contract.instanceOf = contractConfig.instanceOf;
      contract.compiled = compiled_contracts[contractConfig.instanceOf];
    }
    if (contractConfig.address !== undefined) {
      contract.types.push('static');
    }

    contract.deploy = contractConfig.deploy;
    if (contractConfig.deploy === undefined) {
      contract.deploy = true;
    }

    if (this.all_contracts.indexOf(className) < 0) {
      this.all_contracts.push(className);
    }
  }

};

ContractsConfig.prototype.sortContracts = function() {
  var converted_dependencies = [], i;

  for(var contract in this.contractDependencies) {
    var dependencies = this.contractDependencies[contract];
    for(i=0; i < dependencies.length; i++) {
      converted_dependencies.push([contract, dependencies[i]]);
    }
  }

  var orderedDependencies = toposort(converted_dependencies).reverse();

  this.all_contracts = this.all_contracts.sort(function(a,b) {
    var order_a = orderedDependencies.indexOf(a);
    var order_b = orderedDependencies.indexOf(b);
    return order_a - order_b;
  });
};

module.exports = ContractsConfig;

