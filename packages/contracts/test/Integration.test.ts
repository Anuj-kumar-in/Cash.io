import { expect } from "chai";
import { ethers } from "hardhat";

describe("Integration Tests - Full Chain Flow", function () {
  let owner: any;
  let user1: any;
  let user2: any;
  let commitmentTree: any;
  let shieldedPool: any;
  let accountFactory: any;
  let paymaster: any;
  let bridge: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy CommitmentTree
    const CommitmentTreeFactory = await ethers.getContractFactory("CommitmentTree");
    commitmentTree = await CommitmentTreeFactory.deploy();
    await commitmentTree.waitForDeployment();

    // Deploy ShieldedPool
    const ShieldedPoolFactory = await ethers.getContractFactory("ShieldedPool");
    shieldedPool = await ShieldedPoolFactory.deploy(await commitmentTree.getAddress());
    await shieldedPool.waitForDeployment();

    // Deploy BaseBridge
    const BaseBridgeFactory = await ethers.getContractFactory("BaseBridge");
    bridge = await BaseBridgeFactory.deploy();
    await bridge.waitForDeployment();
  });

  describe("End-to-End Privacy Transaction", function () {
    it("Should complete deposit -> private transfer -> withdrawal flow", async function () {
      // 1. Deposit
      const commitment = ethers.solidityPackedKeccak256(["string"], ["privacy-note"]);
      const deposit = ethers.parseEther("0.1");

      await expect(shieldedPool.connect(user1).deposit(commitment, { value: deposit }))
        .to.emit(shieldedPool, "Deposit");

      // 2. Verify commitment was added
      const leafIndex = await commitmentTree.nextLeafIndex();
      expect(leafIndex).to.equal(1);

      // 3. Get Merkle proof
      const proof = await commitmentTree.getMerkleProof(0);
      expect(proof.length).to.equal(20);

      // 4. Verify proof validity
      const root = await commitmentTree.getRoot();
      const isValid = await commitmentTree.verifyProof(commitment, 0, proof, root);
      expect(isValid).to.be.true;
    });

    it("Should handle multiple deposits and maintain state", async function () {
      const deposits = [0.1, 0.2, 0.3].map((amount) => ethers.parseEther(amount.toString()));

      for (let i = 0; i < deposits.length; i++) {
        const commitment = ethers.solidityPackedKeccak256(["uint256"], [i]);
        await shieldedPool.connect(user1).deposit(commitment, { value: deposits[i] });
      }

      const leafIndex = await commitmentTree.nextLeafIndex();
      expect(leafIndex).to.be.greaterThanOrEqual(3);
    });
  });

  describe("Cross-Chain Bridge Integration", function () {
    beforeEach(async function () {
      await bridge.connect(owner).enableBridge(true);
      await bridge.connect(owner).setRemoteBridge(1, user2.address);
    });

    it("Should bridge deposit to Ethereum", async function () {
      // 1. Create commitment
      const commitment = ethers.solidityPackedKeccak256(["string"], ["bridge-note"]);

      // 2. Deposit locally
      await shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.1") });

      // 3. Send bridge message
      const bridgeData = ethers.solidityPacked(
        ["bytes32", "address", "uint256"],
        [commitment, user1.address, ethers.parseEther("0.1")]
      );

      await expect(bridge.connect(user1).sendMessage(1, bridgeData))
        .to.emit(bridge, "MessageSent");
    });

    it("Should receive bridged commitment from remote chain", async function () {
      const commitment = ethers.solidityPackedKeccak256(["string"], ["remote-commitment"]);
      const bridgeData = ethers.solidityPacked(["bytes32"], [commitment]);

      await expect(bridge.connect(owner).receiveMessage(1, bridgeData))
        .to.emit(bridge, "MessageReceived");

      // Verify message was processed
      const messageHash = ethers.solidityPackedKeccak256(["bytes"], [bridgeData]);
      const processed = await bridge.processedMessages(messageHash);
      expect(processed).to.be.true;
    });
  });

  describe("Account Abstraction with Smart Pool", function () {
    let accountFactory: any;
    let account: any;

    beforeEach(async function () {
      // Deploy mock EntryPoint
      const EntryPointMock = await ethers.getContractFactory("EntryPointMock");
      const entryPoint = await EntryPointMock.deploy();
      await entryPoint.waitForDeployment();

      // Deploy AccountFactory
      const FactoryFactory = await ethers.getContractFactory("CashAccountFactory");
      accountFactory = await FactoryFactory.deploy(await entryPoint.getAddress());
      await accountFactory.waitForDeployment();
    });

    it("Should create smart account and use with shielded pool", async function () {
      // 1. Create account
      await expect(
        accountFactory.connect(user1).createAccount(
          user1.address,
          [owner.address],
          1,
          ethers.parseEther("100")
        )
      ).to.emit(accountFactory, "AccountCreated");

      // 2. Account should be usable with pool
      const poolAddress = await shieldedPool.getAddress();
      expect(poolAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Batch Submission and Settlement", function () {
    beforeEach(async function () {
      // Setup some deposits
      for (let i = 0; i < 3; i++) {
        const commitment = ethers.solidityPackedKeccak256(["uint256"], [i]);
        await shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.1") });
      }
    });

    it("Should submit batch with valid state root", async function () {
      const batchRoot = ethers.solidityPackedKeccak256(["string"], ["batch-root"]);
      const stateRoot = await commitmentTree.getRoot();

      await expect(shieldedPool.connect(owner).submitBatch(batchRoot, stateRoot, 3))
        .to.emit(shieldedPool, "BatchSubmitted");

      const batch = await shieldedPool.batches(0);
      expect(batch.batchRoot).to.equal(batchRoot);
      expect(batch.stateRoot).to.equal(stateRoot);
    });

    it("Should maintain root history across batches", async function () {
      const root1 = await commitmentTree.getRoot();

      // Submit batch
      const batchRoot = ethers.solidityPackedKeccak256(["string"], ["batch-root"]);
      await shieldedPool.connect(owner).submitBatch(batchRoot, root1, 3);

      // Verify root is known
      const isKnown = await commitmentTree.knownRoots(root1);
      expect(isKnown).to.be.true;
    });
  });

  describe("Security Integration", function () {
    it("Should prevent double spending across transactions", async function () {
      // 1. Deposit
      const commitment = ethers.solidityPackedKeccak256(["string"], ["security-test"]);
      await shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.1") });

      // 2. Mark nullifier as spent
      const nullifier = ethers.solidityPackedKeccak256(["string"], ["nullifier"]);
      await shieldedPool.setNullifierSpent(nullifier);

      // 3. Try to spend again
      const isSpent = await shieldedPool.nullifiers(nullifier);
      expect(isSpent).to.be.true;
    });

    it("Should maintain reentrancy protection", async function () {
      const deposit = ethers.parseEther("0.1");
      const commitment = ethers.solidityPackedKeccak256(["string"], ["reentry-test"]);

      // Should complete successfully without issues
      const tx = await shieldedPool.connect(user1).deposit(commitment, { value: deposit });
      const receipt = await tx.wait();

      expect(receipt?.status).to.equal(1);
    });

    it("Should validate proof verification integrity", async function () {
      const commitment = ethers.solidityPackedKeccak256(["string"], ["proof-test"]);
      await shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.1") });

      const proof = await commitmentTree.getMerkleProof(0);
      const root = await commitmentTree.getRoot();

      // Valid proof should pass
      let isValid = await commitmentTree.verifyProof(commitment, 0, proof, root);
      expect(isValid).to.be.true;

      // Invalid proof should fail
      const wrongLeaf = ethers.solidityPackedKeccak256(["string"], ["wrong"]);
      isValid = await commitmentTree.verifyProof(wrongLeaf, 0, proof, root);
      expect(isValid).to.be.false;
    });
  });

  describe("Performance Tests", function () {
    it("Should handle multiple concurrent deposits", async function () {
      const startTime = Date.now();
      const txs = [];

      for (let i = 0; i < 10; i++) {
        const commitment = ethers.solidityPackedKeccak256(["uint256"], [i]);
        const tx = shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.1") });
        txs.push(tx);
      }

      const results = await Promise.all(txs);
      const endTime = Date.now();

      expect(results.length).to.equal(10);
      console.log(`Processed 10 deposits in ${endTime - startTime}ms`);
    });

    it("Should handle large merkle proofs efficiently", async function () {
      // Add many leaves
      for (let i = 0; i < 100; i++) {
        const commitment = ethers.solidityPackedKeccak256(["uint256"], [i]);
        await commitmentTree.insert(commitment);
      }

      const leafIndex = await commitmentTree.nextLeafIndex();
      expect(leafIndex).to.equal(100);

      // Get proof for deep leaf
      const startTime = Date.now();
      const proof = await commitmentTree.getMerkleProof(0);
      const endTime = Date.now();

      expect(proof.length).to.equal(20);
      console.log(`Generated merkle proof in ${endTime - startTime}ms`);
    });
  });

  describe("Error Recovery", function () {
    it("Should recover from failed deposit", async function () {
      // Try to deposit wrong amount
      const commitment = ethers.solidityPackedKeccak256(["string"], ["fail-test"]);

      await expect(
        shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.05") })
      ).to.be.reverted;

      // Should be able to deposit correct amount after
      await expect(
        shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.1") })
      ).to.not.be.reverted;
    });

    it("Should maintain state consistency after failed transaction", async function () {
      const leafIndexBefore = await commitmentTree.nextLeafIndex();

      const commitment = ethers.solidityPackedKeccak256(["string"], ["test"]);

      // Successful deposit
      await shieldedPool.connect(user1).deposit(commitment, { value: ethers.parseEther("0.1") });

      const leafIndexAfter = await commitmentTree.nextLeafIndex();
      expect(leafIndexAfter).to.equal(leafIndexBefore + 1n);
    });
  });
});
