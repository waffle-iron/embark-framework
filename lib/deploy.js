var fs = require('fs');
var grunt = require('grunt');
var BigNumber = require('bignumber.js');

Deploy = function(contractsManager, chainManager, withChain, _web3) {
  this.contractsManager = contractsManager;
  this.chainManager = chainManager;
  this.withChain = withChain;
  this.web3 = _web3;
  this.deployedContracts = {};
};

Deploy.waitForContract = function(web3, transactionHash, cb) {
  web3.eth.getTransactionReceipt(transactionHash, function(e, receipt) {
    if (!e  && receipt && receipt.contractAddress !== undefined) {
      cb(receipt.contractAddress);
    }
    else {
      Deploy.waitForContract(web3, transactionHash, cb);
    }
  });
};

Deploy.prototype.deploy_contract = function(web3, contractObject, contractParams, cb) {
  var callback = function(e, contract) {
    if(!e && contract.address !== undefined) {
      cb(contract.address);
    }
    else {
      Deploy.waitForContract(web3, contract.transactionHash, cb);
    }
  };

  contractParams.push(callback);
  contractObject["new"].apply(contractObject, contractParams);
}

Deploy.prototype.deploy_contracts = function(cb) {
  this.contractsManager.compileContracts();
  var all_contracts = this.contractsManager.all_contracts;
  this.contractDB = this.contractsManager.contractDB;
  this.deployedContracts = {};

  //TODO: put an option somewhere for this
  //if(this.blockchainConfig.deploy_synchronously)
  //  this.deploy_contract_list_synchronously(all_contracts, cb);
  //else

  this.deploy_contract_list(all_contracts.length, all_contracts, cb);
}

Deploy.prototype.deploy_contract_list = function(index, all_contracts, cb) {
  if(index === 0) {
    cb();
  }
  else {
    var _this = this;
    this.deploy_contract_list(index - 1, all_contracts, function() {
      var className = all_contracts[index - 1];
      _this.deploy_a_contract(className, cb);
    });
  }
}

Deploy.prototype.deploy_contract_list_synchronously = function(all_contracts, cb) {
  
  var _this = this
    ,deployed_contracts_count = 0

  all_contracts.forEach(function(className){
    _this.deploy_a_contract(className, function(){
      mark_contract_as_deployed()
    });
  })

  function mark_contract_as_deployed(){
    deployed_contracts_count ++;

    if(deployed_contracts_count === all_contracts.length)
      cb()
  }
}

Deploy.prototype.deploy_a_contract = function(className, cb) {
    var contractDependencies = this.contractsManager.contractDependencies;
    var contract = this.contractDB[className];

    if (contract.deploy === false) {
      console.log("skipping " + className);
      cb();
      return;
    }

    var realArgs = [];
    for (var l = 0; l < contract.args.length; l++) {
      arg = contract.args[l];
      if (arg[0] === "$") {
        realArgs.push(this.deployedContracts[arg.substr(1)]);
      } else {
        realArgs.push(arg);
      }
    }

    if (contract.address !== undefined) {
      this.deployedContracts[className] = contract.address;

      console.log("contract " + className + " at " + contract.address);
      cb();
    }
    else {
      var chainContract = this.chainManager.getContract(className, contract.compiled.code, realArgs);

      if (chainContract != undefined && this.web3.eth.getCode(chainContract.address) !== "0x") {
        console.log("contract " + className + " is unchanged and already deployed at " + chainContract.address);
        this.deployedContracts[className] = chainContract.address;
        this.execute_cmds(contract.onDeploy);
        cb();
      }
      else {

        contractObject = this.web3.eth.contract(contract.compiled.info.abiDefinition);

        contractParams = realArgs.slice();
        contractParams.push({
          from: primaryAddress,
          data: contract.compiled.code,
          gas: contract.gasLimit,
          gasPrice: contract.gasPrice
        });

        console.log('trying to obtain ' + className + ' address...');

        var _this = this;
        this.deploy_contract(this.web3, contractObject, contractParams, function(contractAddress) {
          if (_this.web3.eth.getCode(contractAddress) === "0x") {
            console.log("=========");
            console.log("contract was deployed at " + contractAddress + " but doesn't seem to be working");
            console.log("try adjusting your gas values");
            console.log("=========");
          }
          else {
            console.log("deployed " + className + " at " + contractAddress);
            _this.chainManager.addContract(className, contract.compiled.code, realArgs, contractAddress);
            if (_this.withChain) {
              _this.chainManager.save();
            }
          }

          _this.deployedContracts[className] = contractAddress;

          _this.execute_cmds(contract.onDeploy);

          cb();
        });

      }
    }
};

Deploy.prototype.execute_cmds = function(cmds) {
  if (cmds == undefined || cmds.length === 0) return;

  var web3 = this.web3;
  eval(this.generate_abi_file());
  for (var i = 0; i < cmds.length; i++) {
    var cmd = cmds[i];

    for(className in this.deployedContracts) {
      var contractAddress = this.deployedContracts[className];

      var re = new RegExp("\\$" + className, 'g');
      cmd = cmd.replace(re, '"' + contractAddress + '"');
    }

    console.log("executing: " + cmd);
    eval(cmd);
  }
}

Deploy.prototype.generate_provider_file = function(rpcHost, rpcPort) {
  var result = "";
  result += "var web3 = new Web3();";
  result += "web3.setProvider(new web3.providers.HttpProvider('http://" + rpcHost + ":" + rpcPort + "'));";
  result += "web3.eth.defaultAccount = web3.eth.accounts[0];";

  return result;
}

Deploy.prototype.generate_abi_file = function() {
  var result = "";

  for(className in this.deployedContracts) {
    var deployedContract = this.deployedContracts[className];
    var contract = this.contractDB[className];

    var abi = JSON.stringify(contract.compiled.info.abiDefinition);
    var contractAddress = deployedContract;

    console.log('address is ' + contractAddress);

    result += className + "Abi = " + abi + ";";
    result += className + "Contract = web3.eth.contract(" + className + "Abi);";
    result += className + " = " + className + "Contract.at('" + contractAddress + "');";
  }
  result += 'contractDB = '+JSON.stringify(this.contractDB)+';'

  return result;
};

Deploy.prototype.generate_and_write_abi_file = function(destFile) {
  var result = this.generate_abi_file();
  grunt.file.write(destFile, result);
};

module.exports = Deploy;
