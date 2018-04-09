const LinniaHub = artifacts.require("./LinniaHub.sol")
const LinniaRoles = artifacts.require("./LinniaRoles.sol")
const LinniaRecords = artifacts.require("./LinniaRecords.sol")
const LinniaPermissions = artifacts.require("./LinniaPermissions.sol")
const MapDomain = artifacts.require("./MapDomain.sol");
const Zelp = artifacts.require("./Zelp.sol")

const eutil = require("ethereumjs-util")

contract("Zelp", (accounts) => {
  const admin = accounts[0];

  let zelp

  before("set up a the system", async () => {
    const hub = await LinniaHub.new()

    const rolesInstance = await LinniaRoles.new(hub.address)
    await hub.setRolesContract(rolesInstance.address)

    const recordsInstance = await LinniaRecords.new(hub.address)
    await hub.setRecordsContract(recordsInstance.address)

    const permissionsInstance = await LinniaPermissions.new(hub.address, { from: accounts[0] })
    await hub.setPermissionsContract(permissionsInstance.address)

    const mapDomain = await MapDomain.new(hub.address);

    // More fine-grained permissions allowed if needed
    rolesInstance.registerProvider(mapDomain.address, { from: admin })

    zelp = await Zelp.new(mapDomain.address);
  })

  describe("proof", () => {
      it("should create the same proof for a given invoice, as web3.js implementation", async () => {
          const invoice = "0x0000000000000000000000000000000000000000000000000000000000000001";
          const proof = await zelp.proof.call(invoice);
          assert.equal(proof, "0x496e766f6963653a202363326230373332643966636265326237666130636636");
      });
  })

  describe("add", () => {
    it("should add a new file record", async () => {
        const resourceId = "test_resource";
        const endpoint = "https://goo.gl/L9oDYV";
        const restaurant = "test_restaurant";
        await zelp.add(resourceId, endpoint, restaurant);

        const actualPrice = await zelp.prices(resourceId);
        assert.equal(actualPrice.eq(await zelp.DEFAULT_PRICE()), true);

        const fromMetadata = await zelp.metadata(restaurant, 0);
        assert.equal(web3.toUtf8(fromMetadata), resourceId);

        const results = await zelp.search.call(restaurant);
        const resourceIds = results[0];
        const thePrices = results[1];
        assert.equal(resourceIds.length, 1);
        assert.equal(web3.toUtf8(resourceIds[0]), resourceId);
        assert.equal(thePrices[0].eq(actualPrice), true);
    })
  })
})
