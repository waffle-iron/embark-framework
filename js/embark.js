
var EmbarkJS = {
};

options = {
  abi: {},
  address: {},
  code: "",
  options: {},
  web3: {},
  deployPromise: {}
};

//result += "\n" + className + "Abi = " + abi + ";";
//result += "\n" + className + "Contract = web3.eth.contract(" + className + "Abi);";
//result += "\n" + className + " = " + className + "Contract.at('" + contract.deployedAddress + "');";

EmbarkJS.Contract = function(options) {
  var self = this;

  this.abi = options.abi;
  this.address = options.address;
  this.code = options.code;
  this.web3 = options.web3 || web3;

  var ContractClass = web3.eth.contract(this.abi);

  this._originalContractObject = ContractClass.at(this.address);
  this._methods = Object.getOwnPropertyNames(this._originalContractObject).filter(function (p) {
    // TODO: check for forbidden properties
    if (typeof self._originalContractObject[p] === 'function') {
      self[p] = Promise.promisify(self._originalContractObject[p]);
      return true;
    }
    return false;
  });

};

EmbarkJS.Contract.prototype.deploy = function(args) {
  var self = this;
  var contractParams;

  contractParams = args;

  contractParams.push({
    from: web3.eth.accounts[0],
    data: this.code,
    gasLimit: 500000,
    gasPrice: 10000000000000
  });

  var contractObject = web3.eth.contract(this.abi);

  var promise = new Promise(function(resolve, reject) {
    contractParams.push(function(err, transaction) {
      console.log("callback");
      if (err) {
        console.log("error");
        reject(err);
      } else if (transaction.address !== undefined) {
        console.log("address contract: " + transaction.address);
        resolve(new EmbarkJS.Contract({abi: self.abi, code: self.code, address: transaction.address}));
      }
    });
    console.log(contractParams);

    // returns promise
    // deploys contract
    // wraps it around EmbarkJS.Contract
    contractObject["new"].apply(contractObject, contractParams);
  });

  
  return promise;
};

EmbarkJS.Messages = {
};

EmbarkJS.Messages.setProvider = function(msgProvider) {
};

EmbarkJS.Messages.sendMessage = function(options) {
};

EmbarkJS.Messages.listenTo = function(options) {
};

EmbarkJS.Messages.Whisper = {
};

EmbarkJS.Messages.Whisper.sendMessage = function(options) {
};

EmbarkJS.Messages.Whisper.listenTo = function(options) {
};


