pragma solidity ^0.4.18;

import "./MapDomain.sol";

contract Zelp {

    MapDomain public linnia;

    function Zelp(MapDomain _linnia) public {
        linnia = _linnia;
    }

    /* Fallback function */
    function () public { }

    uint constant public DEFAULT_PRICE = 20 szabo;

    enum ResourceState {DEFAULT, BOUGHT, CONSUMED, VOTED}
        
    mapping(bytes32 => mapping(address => mapping(bytes32 => ResourceState))) public used;

    mapping(bytes32 => uint) public prices;
    mapping(bytes32 => bytes32) public endpoints;
    mapping(bytes32 => bytes32[]) public metadata;

    uint32 public nextInvoice;

    function add(bytes32 resourceId,
                 bytes32 endpoint,
                 bytes32 restaurant)
        external
    {
        require(prices[resourceId] == 0); // Shouldn't exist before

        require(linnia.add(resourceId));

        prices[resourceId] = DEFAULT_PRICE;
        endpoints[resourceId] = endpoint;
        metadata[restaurant].push(resourceId);
    }

    function search(bytes32 query)
        external
        view
        returns (bytes32[] resourceIds,
                 uint[]    thePrices)
    {
        uint i;

        bytes32[] storage results = metadata[query];        

        resourceIds = new bytes32[](results.length);
        thePrices = new uint[](results.length);

        for (i = 0; i < results.length; i++) {
            bytes32 resourceId = results[i];
            resourceIds[i] = resourceId;
            thePrices[i] = this.currentPrice(resourceId);
        }
    }

    event Purchase(
        address indexed customer,
        bytes32 endpoint,
        bytes32 resourceId,
        bytes32 invoice
    );

    function purchase(bytes32[] resourceIds)
        payable
        external
    {
        uint i;
        bytes32 resourceId;

        uint totalCost = 0;
        for (i = 0; i < resourceIds.length; i++) {
            resourceId = resourceIds[i];
            require(linnia.validResource(resourceId));
            totalCost += this.currentPrice(resourceId);
        }

        require(msg.value == totalCost);

        address customer = msg.sender;
        bytes32 invoice = bytes32(nextInvoice++);

        for (i = 0; i < resourceIds.length; i++) {
            resourceId = resourceIds[i];
            used[resourceId][customer][invoice] = ResourceState.BOUGHT;
            emit Purchase(customer, endpoints[resourceId], resourceId, invoice);
        }
    }

    function consume(bytes32 resourceId,
                     bytes32 invoice,
                     address customer,
                     bytes32 r,
                     bytes32 s,
                     uint8 v)
        external
        returns (bool)
    {
        address recovered = recover(this.proof(invoice), r, s, v);
        if (recovered != customer) {
            return false;
        }
        if (used[resourceId][customer][invoice] != ResourceState.BOUGHT) {
            return false;
        }
        used[resourceId][customer][invoice] = ResourceState.CONSUMED;
        return true;
    }

    function upvote(bytes32 resourceId,
                    bytes32 invoice,
                    bytes32 r,
                    bytes32 s,
                    uint8 v)
        public
    {
        address customer = msg.sender;
        address recovered = recover(this.proof(invoice), r, s, v);
        require(recovered == customer);

        require(used[resourceId][customer][invoice] == ResourceState.CONSUMED);

        used[resourceId][customer][invoice] = ResourceState.VOTED;

        prices[resourceId] = 2 * this.currentPrice(resourceId);
    }

    function recover(bytes32 message, bytes32 r, bytes32 s, uint8 v)
        public
        pure
        returns (address)
    {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(prefix, message);
        return ecrecover(prefixedHash, v, r, s);
    }

    function currentPrice(bytes32 resourceId)
        view
        external
        returns (uint price)
    {
        price = prices[resourceId];
        require(price != 0);
    }
                
    function proof(bytes32 invoice)
        pure
        external
        returns (bytes32)
    {
        uint i;
        bytes memory toHex = "0123456789abcdef";

        bytes32 hash = keccak256(invoice);
        bytes32 rv = "Invoice: #";

        for (i = 0; i < 11; i++) {
            rv |= bytes32(toHex[uint8(hash[31 - i]) % 16]) >> (8 * (31 - 2 * i));
            rv |= bytes32(toHex[uint8(hash[31 - i]) / 16]) >> (8 * (30 - 2 * i));
        }

        return rv;
    }
}
