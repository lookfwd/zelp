const LinniaHub = artifacts.require("./LinniaHub.sol")
const LinniaRoles = artifacts.require("./LinniaRoles.sol")
const LinniaRecords = artifacts.require("./LinniaRecords.sol")
const LinniaPermissions = artifacts.require("./LinniaPermissions.sol")

const MapDomain = artifacts.require("./MapDomain.sol");
const Zelp = artifacts.require("./Zelp.sol")

var fs = require('fs');

module.exports = (deployer, network, accounts) => {
  const adminAddress = accounts[0]
  let hubInstance, linniaRolesInstance, mapDomainInstance
  // deploy the hub
  deployer.deploy(LinniaHub).then(() => {
    return LinniaHub.deployed()
  }).then((_hubInstace) => {
    hubInstance = _hubInstace
    // deploy Roles
    return deployer.deploy(LinniaRoles, hubInstance.address)
  }).then(() => {
    return LinniaRoles.deployed()
  }).then((_linniaRolesInstance) => {
    linniaRolesInstance = _linniaRolesInstance
    // deploy Records
    return deployer.deploy(LinniaRecords, hubInstance.address)
  }).then(() => {
    // deploy Permissions
    return deployer.deploy(LinniaPermissions, hubInstance.address)
  }).then(() => {
    // set all the addresses in the hub
    return hubInstance.setRolesContract(LinniaRoles.address)
  }).then(() => {
    return hubInstance.setRecordsContract(LinniaRecords.address)
  }).then(() => {
    return hubInstance.setPermissionsContract(LinniaPermissions.address)
  }).then(() => {
    return deployer.deploy(MapDomain, hubInstance.address)
  }).then(() => {
	return MapDomain.deployed();
  }).then((_mapDomainInstance) => {
    mapDomainInstance = _mapDomainInstance;
    return linniaRolesInstance.registerProvider(mapDomainInstance.address, { from: adminAddress })
  }).then((() => {
    return deployer.deploy(Zelp, mapDomainInstance.address)
  })).then(() => {
	return Zelp.deployed();
  }).then((_zelpInstance) => {
	console.log(`export ZELP_ADDRESS=${_zelpInstance.address}`);

    fs.readFile('build/contracts/Zelp.json', 'utf8', function (err, data) {
      if (err) {
        return console.log(err);
      }

      let contract = {
          address: _zelpInstance.address,
          abi: JSON.parse(data).abi
      };

      fs.writeFile("../zelp-web/abi.json", JSON.stringify(contract), function(err) {
          if(err) {
              return console.log(err);
          }
          fs.writeFile("../serverless/abi.json", JSON.stringify(contract), function(err) {
              if(err) {
                  return console.log(err);
              }
              console.log("ABI files saved!");
          }); 
      }); 
    });
    
    fs.readFile('../serverless/default_records.json', 'utf8', function (err, data) {
        const records = JSON.parse(data);
        for (let i = 0; i < records.length; ++i) {
            const record = records[i];
            _zelpInstance.add(record.id, record.endpoint, record.restaurant);
        }
    });
  })
}
