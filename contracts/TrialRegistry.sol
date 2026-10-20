// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// Discovery-before-disclosure registry. Patients publish only a Merkle root of
/// hashed tags (padded with random leaves). Contact details are released only
/// inside consent(), after on-chain Merkle verification, encrypted to the trial's key.
contract TrialRegistry {
    struct Trial {
        address researcher;
        string title;
        bytes32[] criteria;
        bytes pubKey;
        uint32 consents;
        bool open;
    }

    mapping(address => bytes32) public patientRoot;
    uint256 public patientCount;
    Trial[] private trials;
    mapping(uint256 => mapping(address => bool)) public consented;

    event PatientRegistered(address indexed patient, bytes32 root);
    event TrialCreated(uint256 indexed id, address indexed researcher, string title);
    event TrialClosed(uint256 indexed id);
    event Consented(uint256 indexed id, address indexed patient, bytes encContact);
    event Withdrawn(uint256 indexed id, address indexed patient);

    function registerPatient(bytes32 root) external {
        require(root != bytes32(0), "empty root");
        if (patientRoot[msg.sender] == bytes32(0)) patientCount++;
        patientRoot[msg.sender] = root;
        emit PatientRegistered(msg.sender, root);
    }

    function createTrial(string calldata title, bytes32[] calldata criteria, bytes calldata pubKey)
        external returns (uint256 id)
    {
        require(criteria.length > 0 && criteria.length <= 8, "1-8 criteria");
        require(pubKey.length == 65, "bad key");
        id = trials.length;
        trials.push(Trial(msg.sender, title, criteria, pubKey, 0, true));
        emit TrialCreated(id, msg.sender, title);
    }

    function closeTrial(uint256 id) external {
        require(trials[id].researcher == msg.sender, "not owner");
        trials[id].open = false;
        emit TrialClosed(id);
    }

    function consent(uint256 id, bytes32[] calldata leaves, bytes32[][] calldata proofs, bytes calldata encContact)
        external
    {
        Trial storage t = trials[id];
        require(t.open, "closed");
        require(!consented[id][msg.sender], "already consented");
        bytes32 root = patientRoot[msg.sender];
        require(root != bytes32(0), "not registered");
        require(leaves.length == t.criteria.length && proofs.length == leaves.length, "length");
        for (uint256 i; i < leaves.length; i++) {
            require(leaves[i] == t.criteria[i], "criterion mismatch");
            bytes32 h = keccak256(bytes.concat(keccak256(abi.encode(leaves[i]))));
            require(MerkleProof.verify(proofs[i], root, h), "bad proof");
        }
        consented[id][msg.sender] = true;
        t.consents++;
        emit Consented(id, msg.sender, encContact);
    }

    /// A patient can withdraw a recorded consent at any time, even after the trial closes, and may consent again later.
    function withdraw(uint256 id) external {
        require(consented[id][msg.sender], "no consent");
        consented[id][msg.sender] = false;
        trials[id].consents--;
        emit Withdrawn(id, msg.sender);
    }

    function trialCount() external view returns (uint256) { return trials.length; }
    function getTrial(uint256 id) external view returns (Trial memory) { return trials[id]; }
}
