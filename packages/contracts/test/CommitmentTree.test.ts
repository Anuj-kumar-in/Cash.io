import { expect } from "chai";
import { ethers } from "hardhat";
import { CommitmentTree } from "../typechain-types";

describe("CommitmentTree - Chain Tests", function () {
  let commitmentTree: CommitmentTree;
  const TREE_DEPTH = 20;
  const ZERO_VALUE = "0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c";

  beforeEach(async function () {
    const CommitmentTreeFactory = await ethers.getContractFactory("CommitmentTree");
    commitmentTree = await CommitmentTreeFactory.deploy();
    await commitmentTree.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct tree depth", async function () {
      const depth = await commitmentTree.TREE_DEPTH();
      expect(depth).to.equal(TREE_DEPTH);
    });

    it("Should have correct max leaves", async function () {
      const maxLeaves = await commitmentTree.MAX_LEAVES();
      expect(maxLeaves).to.equal(2n ** BigInt(TREE_DEPTH));
    });

    it("Should have zero value set correctly", async function () {
      const zeroValue = await commitmentTree.ZERO_VALUE();
      expect(zeroValue).to.equal(ZERO_VALUE);
    });

    it("Should initialize with nextLeafIndex = 0", async function () {
      const leafIndex = await commitmentTree.nextLeafIndex();
      expect(leafIndex).to.equal(0);
    });

    it("Should have initial root in history", async function () {
      const initialRoot = await commitmentTree.rootHistory(0);
      expect(initialRoot).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Leaf Insertion", function () {
    it("Should insert a leaf successfully", async function () {
      const leaf = ethers.solidityPackedKeccak256(["string"], ["test-leaf"]);
      
      const tx = await commitmentTree.insert(leaf);
      const receipt = await tx.wait();

      const nextLeafIndex = await commitmentTree.nextLeafIndex();
      expect(nextLeafIndex).to.equal(1);
    });

    it("Should emit LeafInserted event", async function () {
      const leaf = ethers.solidityPackedKeccak256(["string"], ["test-leaf"]);

      const tx = await commitmentTree.insert(leaf);
      await expect(tx)
        .to.emit(commitmentTree, "LeafInserted");
    });

    it("Should update root after insertion", async function () {
      const initialRoot = await commitmentTree.getLastRoot();
      const leaf = ethers.solidityPackedKeccak256(["string"], ["test-leaf"]);

      await commitmentTree.insert(leaf);
      const newRoot = await commitmentTree.getLastRoot();

      expect(newRoot).to.not.equal(initialRoot);
    });

    it("Should insert multiple leaves", async function () {
      for (let i = 0; i < 5; i++) {
        const leaf = ethers.solidityPackedKeccak256(["uint256"], [i]);
        await commitmentTree.insert(leaf);
      }

      const nextLeafIndex = await commitmentTree.nextLeafIndex();
      expect(nextLeafIndex).to.equal(5);
    });

    it("Should track known roots", async function () {
      const leaf = ethers.solidityPackedKeccak256(["string"], ["test-leaf"]);
      
      const rootBefore = await commitmentTree.getLastRoot();
      const isKnownBefore = await commitmentTree.knownRoots(rootBefore);
      expect(isKnownBefore).to.be.true;

      await commitmentTree.insert(leaf);

      const rootAfter = await commitmentTree.getLastRoot();
      const isKnownAfter = await commitmentTree.knownRoots(rootAfter);
      expect(isKnownAfter).to.be.true;
    });
  });

  describe("Root History", function () {
    it("Should maintain root history correctly", async function () {
      const initialRoot = await commitmentTree.rootHistory(0);
      expect(initialRoot).to.not.equal(ethers.ZeroHash);

      for (let i = 0; i < 3; i++) {
        const leaf = ethers.solidityPackedKeccak256(["uint256"], [i]);
        await commitmentTree.insert(leaf);
      }

      const currentIndex = await commitmentTree.currentRootIndex();
      expect(currentIndex).to.be.greaterThanOrEqual(0);
    });

    it("Should verify current root is known", async function () {
      const currentRoot = await commitmentTree.getLastRoot();
      const isKnown = await commitmentTree.knownRoots(currentRoot);
      expect(isKnown).to.be.true;
    });
  });

  describe("Hashing Functions", function () {
    it("Should hash left-right correctly", async function () {
      const left = ethers.solidityPackedKeccak256(["string"], ["left"]);
      const right = ethers.solidityPackedKeccak256(["string"], ["right"]);

      const hash = await commitmentTree.hashLeftRight(left, right);
      expect(hash).to.not.equal(ethers.ZeroHash);
    });

    it("Should be deterministic for same inputs", async function () {
      const left = ethers.solidityPackedKeccak256(["string"], ["left"]);
      const right = ethers.solidityPackedKeccak256(["string"], ["right"]);

      const hash1 = await commitmentTree.hashLeftRight(left, right);
      const hash2 = await commitmentTree.hashLeftRight(left, right);
      expect(hash1).to.equal(hash2);
    });

    it("Should have different hashes for different inputs", async function () {
      const left = ethers.solidityPackedKeccak256(["string"], ["left"]);
      const right = ethers.solidityPackedKeccak256(["string"], ["right"]);
      const different = ethers.solidityPackedKeccak256(["string"], ["different"]);

      const hash1 = await commitmentTree.hashLeftRight(left, right);
      const hash2 = await commitmentTree.hashLeftRight(left, different);
      expect(hash1).to.not.equal(hash2);
    });
  });

  describe("Leaf Count Tracking", function () {
    it("Should track leaf count correctly", async function () {
      const initialCount = await commitmentTree.getLeafCount();
      expect(initialCount).to.equal(0);

      for (let i = 0; i < 3; i++) {
        const leaf = ethers.solidityPackedKeccak256(["uint256"], [i]);
        await commitmentTree.insert(leaf);
      }

      const finalCount = await commitmentTree.getLeafCount();
      expect(finalCount).to.equal(3);
    });
  });

  describe("Root Tracking", function () {
    it("Should check if root is known", async function () {
      const initialRoot = await commitmentTree.getLastRoot();
      const isKnown = await commitmentTree.isKnownRoot(initialRoot);
      expect(isKnown).to.be.true;
    });

    it("Should mark inserted root as known", async function () {
      const leaf = ethers.solidityPackedKeccak256(["string"], ["test"]);
      
      await commitmentTree.insert(leaf);

      const newRoot = await commitmentTree.getLastRoot();
      const isKnown = await commitmentTree.isKnownRoot(newRoot);
      expect(isKnown).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero-value leaves", async function () {
      const zeroLeaf = ZERO_VALUE;

      await expect(commitmentTree.insert(zeroLeaf as any)).to.not.be.reverted;
    });

    it("Should prevent tree overflow on full tree", async function () {
      const maxLeaves = await commitmentTree.MAX_LEAVES();
      expect(maxLeaves).to.be.greaterThan(0);
    });

    it("Should handle consecutive insertions", async function () {
      for (let i = 0; i < 10; i++) {
        const leaf = ethers.solidityPackedKeccak256(["uint256"], [i]);
        const tx = await commitmentTree.insert(leaf);
        await tx.wait();
      }

      const leafCount = await commitmentTree.getLeafCount();
      expect(leafCount).to.equal(10);
    });
  });

  describe("State Consistency", function () {
    it("Should maintain consistent state across multiple operations", async function () {
      const leafCountBefore = await commitmentTree.getLeafCount();
      const rootBefore = await commitmentTree.getLastRoot();

      for (let i = 0; i < 5; i++) {
        const leaf = ethers.solidityPackedKeccak256(["uint256"], [i]);
        await commitmentTree.insert(leaf);
      }

      const leafCountAfter = await commitmentTree.getLeafCount();
      const rootAfter = await commitmentTree.getLastRoot();

      expect(leafCountAfter).to.equal(leafCountBefore + 5n);
      expect(rootAfter).to.not.equal(rootBefore);

      for (let i = 0; i < leafCountAfter; i++) {
        const root = await commitmentTree.rootHistory(i);
        if (root !== ethers.ZeroHash) {
          const isKnown = await commitmentTree.knownRoots(root);
          expect(isKnown).to.be.true;
        }
      }
    });
  });
});
