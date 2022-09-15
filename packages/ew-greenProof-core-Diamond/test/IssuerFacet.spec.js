const {
  getSelector,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets,
} = require("../scripts/libraries/diamond");

const chai = require("chai");
const { expect } = require("chai");
const { parseEther } = require("ethers").utils;
const { ethers, network } = require("hardhat");
const { deployDiamond } = require("../scripts/deploy");
const {
  deployMockContract,
  MockContract,
  solidity,
} = require("ethereum-waffle");
const { claimManagerInterface, toBytes32, checkProof, getMerkleProof } = require("./utils");
const { createMerkleTree, createPreciseProof, hash } = require('@energyweb/greenproof-merkle-tree')
chai.use(solidity);

const timeTravel = async (seconds) => {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine", []);
};

let issuerFacet;
let diamondAddress;
let proofManagerFacet;
let owner;
let receiver;
let validator;
let receiverAddress;
let amount;
let productType;
let start;
let end;
let winninMatch;
let producerRef;
let grantRole;
let revokeRole;
let VC;
let merkleInfos;
let testCounter = 0;
let lastTokenID = 0;

const rewardAmount = parseEther("1");
const timeLimit = 15 * 60;
const issuerRole = ethers.utils.namehash(
  "minter.roles.greenproof.apps.iam.ewc"
);
const validatorRole = ethers.utils.namehash(
  "validator.roles.greenproof.apps.iam.ewc"
);
const revokerRole = ethers.utils.namehash(
  "revoker.roles.greenproof.apps.iam.ewc"
);
const workerRole = ethers.utils.namehash(
  "workerRole.roles.greenproof.apps.iam.ewc"
);
const defaultVersion = 1;
const proofID1 = 1;
const proofID2 = 2;

describe("IssuerFacet", function () {
  before(async () => {
    [
      owner,
      validator,
      minter,
      receiver,
      revoker,
      nonAuthorizedOperator,
      worker5,
      worker6,
      notEnrolledWorker,
      toRemoveWorker,
    ] = await ethers.getSigners();
    console.log(`\n`);

    //  Mocking claimManager
    const claimManagerMocked = await deployMockContract(
      owner,
      claimManagerInterface
    );

    grantRole = async (operatorWallet, role) => {
      await claimManagerMocked.mock.hasRole
        .withArgs(operatorWallet.address, role, defaultVersion)
        .returns(true);
    };

    revokeRole = async (operatorWallet, role) => {
      await claimManagerMocked.mock.hasRole
        .withArgs(operatorWallet.address, role, defaultVersion)
        .returns(false);
    };

    const roles = {
      issuerRole,
      revokerRole,
      validatorRole,
      workerRole,
    };

    diamondAddress = await deployDiamond(
      timeLimit,
      rewardAmount,
      claimManagerMocked.address,
      roles
    );
    diamondCutFacet = await ethers.getContractAt(
      "DiamondCutFacet",
      diamondAddress
    );
    diamondLoupeFacet = await ethers.getContractAt(
      "DiamondLoupeFacet",
      diamondAddress
    );
    ownershipFacet = await ethers.getContractAt(
      "OwnershipFacet",
      diamondAddress
    );
    issuerFacet = await ethers.getContractAt("IssuerFacet", diamondAddress);
    proofManagerFacet = await ethers.getContractAt(
      "ProofManagerFacet",
      diamondAddress
    );

    receiverAddress = receiver.address;
    amount = 42;
    productType = 1;
    start = 1234567890;
    end = 9876543210;
    winninMatch = "MATCH_RESULT_1";
    secondMatch = "MATCH_RESULT_2";
    producerRef = ethers.utils.namehash("energyWeb");

    const data = {
      receiverAddress,
      amount,
      productType,
      timeFrame: {   
        start,
        end,
      },
      winninMatch,
      producerRef,
      type: "solar",
      generatorID: 4221
    }
    merkleInfos = getMerkleProof(data);
    VC = merkleInfos.merkleRoot;
  });

  beforeEach(async () => {
    console.log(`Test ${++testCounter} :`);
  });

  afterEach(async () => {
    console.log("\t----------");
  });

  describe("\n** Proof issuance tests **\n", () => {
    it("reverts when we try to validate request before request issuance", async () => {
      await grantRole(validator, validatorRole);
      expect(
        issuerFacet
          .connect(validator)
          ["validateIssuanceRequest(string,bytes32)"](winninMatch, VC)
      ).to.be.revertedWith("Validation not requested");
    });

    it("Can send proof issuance requests", async () => {
      expect(
        await issuerFacet
          .connect(owner)
          .requestProofIssuance(winninMatch, receiverAddress)
      ).to.emit(issuerFacet, "IssuanceRequested");
    });

    it("Reverts when one re-sends an already requested issuance", async () => {
      expect(
        issuerFacet
          .connect(owner)
          .requestProofIssuance(winninMatch, receiverAddress)
      ).to.be.revertedWith("Request: Already requested proof");
    });

    it("Non Authorized validator cannot validate issuance requests", async () => {
      await revokeRole(validator, validatorRole);
      expect(
        issuerFacet
          .connect(validator)
          ["validateIssuanceRequest(string,bytes32)"](winninMatch, VC)
      ).to.be.revertedWith("Access: Not a validator");
    });

    it("Non authorized validator cannot validate nor mint proofs", async () => {
      
      await revokeRole(validator, validatorRole);
      await expect(
        issuerFacet
          .connect(validator)
          [
            "validateIssuanceRequest(string,bytes32,address,uint256,uint256,uint256,uint256,bytes32)"
          ](
            winninMatch,
            VC,
            receiverAddress,
            amount,
            productType,
            start,
            end,
            producerRef
          )
      ).to.be.revertedWith("Access: Not a validator");
    });

    it("Authorized validator can validate issuance requests", async () => {
      lastTokenID++;
      await grantRole(validator, validatorRole);
      expect(
        await issuerFacet
          .connect(validator)
          ["validateIssuanceRequest(string,bytes32)"](winninMatch, VC)
      ).to.emit(issuerFacet, "RequestAccepted");
    });

    it("checks that the certified generation volume is zero before minting", async () => {
      lastTokenID++;
      const amountBeforMint = await issuerFacet.balanceOf(receiverAddress, lastTokenID);
      expect(amountBeforMint).to.equal(0);
    });

    it("Authorized validator can validate and mint proofs", async () => {
      await grantRole(validator, validatorRole);
      let id;
      let tx;
      //step 1: request issuance
      expect(
        await issuerFacet
          .connect(owner)
          .requestProofIssuance(secondMatch, receiverAddress)
      ).to.emit(issuerFacet, "IssuanceRequested");

      //step 2: validate issuance request
      tx = await issuerFacet
        .connect(validator)
        [
          "validateIssuanceRequest(string,bytes32,address,uint256,uint256,uint256,uint256,bytes32)"
        ](
          secondMatch,
          VC,
          receiverAddress,
          amount,
          productType,
          start,
          end,
          producerRef
        );
      await tx.wait();
      expect(tx).to.emit(issuerFacet, "ProofMinted").withArgs(lastTokenID, amount);
    });

    it("checks that the certified generation volume is correct after minting", async () => {
      const amountMinted = await issuerFacet.balanceOf(receiverAddress, lastTokenID);
      expect(amountMinted).to.equal(amount);
    });

    //TODO: test request rejection
  });

  describe("\n** Proof revocation tests **\n", () => {

    it("should verify all kinds of proofs", async () => {
      const arr = [
        {
          id: 1,
          generatorID: 2,
          volume: 10,
          consumerID: 500
        },
        {
          id: 2,
          generatorID: 3,
          volume: 10,
          consumerID: 522
        },
        {
          id: 3,
          generatorID: 4,
          volume: 10,
          consumerID: 52
        },
        {
          id: 4,
          generatorID: 5,
          volume: 10,
          consumerID: 53
        },
        {
          id: 5,
          generatorID: 5,
          volume: 10,
          consumerID: 51
        },
      ]
      const leaves = arr.map(item => createPreciseProof(item).getHexRoot())
      const tree = createMerkleTree(leaves);

      const leaf = leaves[1];
      const proof = tree.getHexProof(leaf);
      const root = tree.getHexRoot()
      expect(await proofManagerFacet.connect(owner).verifyProof(root, leaf, proof)).to.be.true;

      const leafTree = createPreciseProof(arr[1])
      const leafRoot = leafTree.getHexRoot()
      const leafLeaf = hash('consumerID' + JSON.stringify(522))
      const leafProof = leafTree.getHexProof(leafLeaf)
      expect(await proofManagerFacet.connect(owner).verifyProof(leafRoot, leafLeaf, leafProof)).to.be.true;
    })

    it("should successfully verify a proof", async () => {
      expect(
        await proofManagerFacet.connect(owner).verifyProof(VC, merkleInfos.proofs[ 0 ].hexLeaf, merkleInfos.proofs[ 0 ].leafProof)
      ).to.be.true;
    });

    it("should prevent a non authorized entity from revoking non retired proof", async () => {
      await revokeRole(nonAuthorizedOperator, revokerRole);
      await expect(
        proofManagerFacet.connect(nonAuthorizedOperator).revokeProof(proofID1)
      ).to.be.revertedWith("Access: Not enrolled as revoker");
    });

    it("should allow an authorized entity to revoke non retired proof", async () => {
      await grantRole(revoker, revokerRole);
      await expect(
        proofManagerFacet.connect(revoker).revokeProof(proofID1)
      ).to.emit(proofManagerFacet, "ProofRevoked");
    });

    it("should reverts if one tries to retire a revoked proof", async () => {
      await expect(
        proofManagerFacet.connect(owner).retireProof(owner.address, proofID1, 1)
      ).to.be.revertedWith("proof revoked");
    });

    it("should allow proof retirement", async () => {
      await grantRole(validator, validatorRole);
      let id;
      let tx;
      //step 1: request issuance
      expect(
        await issuerFacet
          .connect(owner)
          .requestProofIssuance("WinningMatch 3", receiverAddress)
      ).to.emit(issuerFacet, "IssuanceRequested");

      //step 2: validate issuance request
      lastTokenID++;
      tx = await issuerFacet
        .connect(validator)
      [
        "validateIssuanceRequest(string,bytes32,address,uint256,uint256,uint256,uint256,bytes32)"
      ](
        "WinningMatch 3",
        VC,
        receiverAddress,
        amount,
        productType,
        start,
        end,
        producerRef
      );
      await tx.wait();
      expect(tx).to.emit(issuerFacet, "ProofMinted").withArgs(lastTokenID, amount);

      //step3: retire proof
      console.log("Retiring certificate ID ", lastTokenID);
      console.log("Balance Before retiremeent:: ", await issuerFacet.balanceOf(receiverAddress, lastTokenID));

      
      await expect(
        proofManagerFacet.connect(receiver).retireProof(receiverAddress, lastTokenID, 21)
      ).to.emit(proofManagerFacet, "ProofRetired").withArgs(lastTokenID, 21);
      
      const balance1 = await issuerFacet.balanceOf(receiverAddress, lastTokenID);
      const balance2 = await issuerFacet.balanceOf(receiverAddress, lastTokenID - 1);
      console.log(`Remaining Balance on certificate ${lastTokenID}:: `, balance1);
      console.log(`Remaining Balance on certificate ${lastTokenID -1 }:: `, balance2);
       // expect(amountMinted).to.equal(amount);
    });

    it("should revert if an already retired proof is is beeing retired", async () => {
      //TODO: check that a non retired proof can be revoked
      
      
    });

    it("should prevent authorized revoker from revoking a retired proof after the revocable Period", async () => {
      //TODO: check thata retired proof cannot be revoked
    });
  });
});
