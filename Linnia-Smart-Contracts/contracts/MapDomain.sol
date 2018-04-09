pragma solidity ^0.4.18;

import "./LinniaHub.sol";
import "./LinniaRecords.sol";

contract MapDomain {

    uint8 constant FileRecord_recordType_offset = 3;

    LinniaHub public hub;

    function MapDomain(LinniaHub _hub) public {
        hub = _hub;
        hub.rolesContract().registerPatient();
    }

    /* Fallback function */
    function () public { }

    function add(bytes32 resourceId)
        external
        returns (bool)
    {
        if (!hub.recordsContract().addRecordByPatient(
            resourceId,   // bytes32 fileHash,
            1,            // uint recordType,
            resourceId))  // bytes32 ipfsHash
        {
            return false;
        }
        return true;
    }

    function validResource(bytes32 resourceId)
        external
        returns (bool)
    {
        // It would be better if there was a way to retrieve if there's a valid record
        address patient;
        uint sigCount;
        uint irisScore;
        uint recordType;
        bytes32 ipfsHash;
        uint timestamp;

        (patient, sigCount, irisScore, recordType, ipfsHash, timestamp) = hub.recordsContract().records(resourceId);
        return recordType != 0;
    }
}
