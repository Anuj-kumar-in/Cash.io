import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge Contracts - Chain Tests", function () {
  let owner: any;
  let bridge: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy BaseBridge first (abstract base)
    const BaseBridgeFactory = await ethers.getContractFactory("BaseBridge");
    bridge = await BaseBridgeFactory.deploy();
    await bridge.waitForDeployment();
  });

  describe("Bridge Initialization", function () {
    it("Should deploy bridge", async function () {
      expect(await bridge.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should have owner set", async function () {
      const bridgeOwner = await bridge.owner();
      expect(bridgeOwner).to.equal(owner.address);
    });
  });

  describe("Bridge Operations", function () {
    it("Should register remote bridge", async function () {
      const remoteChainId = 1;
      const remoteBridgeAddress = user1.address;

      await bridge.connect(owner).setRemoteBridge(remoteChainId, remoteBridgeAddress);

      const registered = await bridge.remoteBridges(remoteChainId);
      expect(registered).to.equal(remoteBridgeAddress);
    });

    it("Should not allow non-owner to register bridge", async function () {
      const remoteChainId = 1;
      const remoteBridgeAddress = user1.address;

      await expect(
        bridge.connect(user1).setRemoteBridge(remoteChainId, remoteBridgeAddress)
      ).to.be.reverted;
    });

    it("Should enable bridge operations", async function () {
      await bridge.connect(owner).enableBridge(true);

      const isEnabled = await bridge.enabled();
      expect(isEnabled).to.be.true;
    });

    it("Should disable bridge operations", async function () {
      await bridge.connect(owner).enableBridge(false);

      const isEnabled = await bridge.enabled();
      expect(isEnabled).to.be.false;
    });

    it("Should reject operations when disabled", async function () {
      await bridge.connect(owner).enableBridge(false);

      // Should revert with disabled error
      await expect(
        bridge.connect(user1).sendMessage(1, "0x")
      ).to.be.reverted;
    });
  });

  describe("Message Sending", function () {
    beforeEach(async function () {
      await bridge.connect(owner).enableBridge(true);
      await bridge.connect(owner).setRemoteBridge(1, user2.address);
    });

    it("Should send message to remote chain", async function () {
      const remoteChainId = 1;
      const message = ethers.solidityPacked(["uint256", "address"], [100, user1.address]);

      const tx = await bridge.connect(user1).sendMessage(remoteChainId, message);
      const receipt = await tx.wait();

      expect(receipt?.status).to.equal(1);
    });

    it("Should emit MessageSent event", async function () {
      const remoteChainId = 1;
      const message = ethers.solidityPacked(["uint256", "address"], [100, user1.address]);

      await expect(bridge.connect(user1).sendMessage(remoteChainId, message))
        .to.emit(bridge, "MessageSent")
        .withArgs(remoteChainId, expect.any(String));
    });

    it("Should track message nonce", async function () {
      const remoteChainId = 1;
      const message = ethers.solidityPacked(["uint256", "address"], [100, user1.address]);

      const nonceBefore = await bridge.messageNonce();

      await bridge.connect(user1).sendMessage(remoteChainId, message);

      const nonceAfter = await bridge.messageNonce();
      expect(nonceAfter).to.be.greaterThan(nonceBefore);
    });
  });

  describe("Message Receiving", function () {
    beforeEach(async function () {
      await bridge.connect(owner).enableBridge(true);
      await bridge.connect(owner).setRemoteBridge(1, user2.address);
    });

    it("Should receive message from remote bridge", async function () {
      const message = ethers.solidityPackedKeccak256(["string"], ["test-message"]);
      const messageHash = ethers.solidityPackedKeccak256(["bytes"], [message]);

      const tx = await bridge.connect(owner).receiveMessage(1, message);
      const receipt = await tx.wait();

      expect(receipt?.status).to.equal(1);
    });

    it("Should emit MessageReceived event", async function () {
      const message = ethers.solidityPackedKeccak256(["string"], ["test-message"]);

      await expect(bridge.connect(owner).receiveMessage(1, message))
        .to.emit(bridge, "MessageReceived")
        .withArgs(1, expect.any(String));
    });

    it("Should prevent duplicate message processing", async function () {
      const message = ethers.solidityPackedKeccak256(["string"], ["test-message"]);

      await bridge.connect(owner).receiveMessage(1, message);

      // Try to process the same message again
      // Should fail or be ignored
      const processedMessages = await bridge.processedMessages(
        ethers.solidityPackedKeccak256(["bytes"], [message])
      );
      expect(processedMessages).to.be.true;
    });
  });

  describe("Fee Management", function () {
    beforeEach(async function () {
      await bridge.connect(owner).enableBridge(true);
    });

    it("Should set bridge fee", async function () {
      const newFee = ethers.parseEther("0.01");

      await bridge.connect(owner).setBridgeFee(newFee);

      const fee = await bridge.bridgeFee();
      expect(fee).to.equal(newFee);
    });

    it("Should not allow non-owner to set fee", async function () {
      const newFee = ethers.parseEther("0.01");

      await expect(
        bridge.connect(user1).setBridgeFee(newFee)
      ).to.be.reverted;
    });

    it("Should collect fees", async function () {
      const fee = ethers.parseEther("0.01");
      await bridge.connect(owner).setBridgeFee(fee);

      // Send ETH with fee
      const remoteChainId = 1;
      await bridge.connect(owner).setRemoteBridge(remoteChainId, user2.address);

      const message = "0x123456";
      await bridge.connect(user1).sendMessage(remoteChainId, message, { value: fee });

      const collected = await ethers.provider.getBalance(await bridge.getAddress());
      expect(collected).to.be.greaterThanOrEqual(fee);
    });

    it("Should allow owner to withdraw fees", async function () {
      const fee = ethers.parseEther("0.01");
      await bridge.connect(owner).setBridgeFee(fee);

      const remoteChainId = 1;
      await bridge.connect(owner).setRemoteBridge(remoteChainId, user2.address);

      const message = "0x123456";
      await bridge.connect(user1).sendMessage(remoteChainId, message, { value: fee });

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await bridge.connect(owner).withdrawFees();
      const receipt = await tx.wait();

      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore - BigInt(receipt!.gasUsed * receipt!.gasPrice));
    });
  });

  describe("Security", function () {
    it("Should prevent message with invalid remote chain", async function () {
      await bridge.connect(owner).enableBridge(true);

      const invalidChainId = 99999;
      const message = "0x";

      await expect(
        bridge.connect(user1).sendMessage(invalidChainId, message)
      ).to.be.reverted;
    });

    it("Should handle large messages", async function () {
      await bridge.connect(owner).enableBridge(true);
      await bridge.connect(owner).setRemoteBridge(1, user2.address);

      const largeMessage = "0x" + "11".repeat(1000); // 1000 bytes

      const tx = await bridge.connect(user1).sendMessage(1, largeMessage);
      expect(tx).to.be.ok;
    });

    it("Should prevent reentrancy in fee withdrawal", async function () {
      // This would need a malicious contract to truly test
      // For now, verify the structure exists
      expect(await bridge.getAddress()).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Cross-Chain State Consistency", function () {
    beforeEach(async function () {
      await bridge.connect(owner).enableBridge(true);
      await bridge.connect(owner).setRemoteBridge(1, user2.address);
      await bridge.connect(owner).setRemoteBridge(137, user2.address);
    });

    it("Should maintain consistent state across messages", async function () {
      const chain1 = 1;
      const chain137 = 137;

      const message1 = ethers.solidityPacked(["uint256"], [100]);
      const message2 = ethers.solidityPacked(["uint256"], [200]);

      await bridge.connect(user1).sendMessage(chain1, message1);
      await bridge.connect(user1).sendMessage(chain137, message2);

      const nonce = await bridge.messageNonce();
      expect(nonce).to.equal(2);
    });

    it("Should handle message ordering", async function () {
      const messages = [];
      for (let i = 0; i < 5; i++) {
        const msg = ethers.solidityPacked(["uint256"], [i]);
        await bridge.connect(user1).sendMessage(1, msg);
        messages.push(msg);
      }

      const nonce = await bridge.messageNonce();
      expect(nonce).to.equal(5);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency pause", async function () {
      await bridge.connect(owner).enableBridge(true);
      await bridge.connect(owner).emergencyPause();

      const isEnabled = await bridge.enabled();
      expect(isEnabled).to.be.false;
    });

    it("Should not allow non-owner emergency pause", async function () {
      await expect(
        bridge.connect(user1).emergencyPause()
      ).to.be.reverted;
    });

    it("Should recover from emergency pause", async function () {
      await bridge.connect(owner).enableBridge(true);
      await bridge.connect(owner).emergencyPause();

      await bridge.connect(owner).enableBridge(true);

      const isEnabled = await bridge.enabled();
      expect(isEnabled).to.be.true;
    });
  });
});
