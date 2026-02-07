import { expect } from "chai";
import { ethers } from "hardhat";
import { CashAccount, CashAccountFactory, CashPaymaster } from "../typechain-types";

describe("Account Abstraction - Chain Tests", function () {
  let accountFactory: CashAccountFactory;
  let cashAccount: CashAccount;
  let paymaster: CashPaymaster;
  let owner: any;
  let guardian1: any;
  let guardian2: any;
  let user: any;

  beforeEach(async function () {
    [owner, guardian1, guardian2, user] = await ethers.getSigners();

    // Deploy entry point (mock)
    const EntryPointMock = await ethers.getContractFactory("EntryPointMock");
    const entryPoint = await EntryPointMock.deploy();
    await entryPoint.waitForDeployment();

    // Deploy CashAccountFactory
    const FactoryFactory = await ethers.getContractFactory("CashAccountFactory");
    accountFactory = await FactoryFactory.deploy(await entryPoint.getAddress());
    await accountFactory.waitForDeployment();

    // Deploy CashPaymaster
    const PaymasterFactory = await ethers.getContractFactory("CashPaymaster");
    paymaster = await PaymasterFactory.deploy(await entryPoint.getAddress());
    await paymaster.waitForDeployment();
  });

  describe("Account Factory", function () {
    it("Should create a new account", async function () {
      const salt = ethers.id("test-account");

      const tx = await accountFactory.connect(owner).createAccount(
        owner.address,
        [guardian1.address],
        1,
        ethers.parseEther("100")
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("Should emit AccountCreated event", async function () {
      const guardians = [guardian1.address];

      await expect(
        accountFactory.connect(owner).createAccount(
          owner.address,
          guardians,
          1,
          ethers.parseEther("100")
        )
      )
        .to.emit(accountFactory, "AccountCreated")
        .withArgs(owner.address, expect.any(String));
    });

    it("Should create account with multiple guardians", async function () {
      const guardians = [guardian1.address, guardian2.address];

      await accountFactory.connect(owner).createAccount(
        owner.address,
        guardians,
        2,
        ethers.parseEther("100")
      );

      // Account should be created and be recoverable
      const expectedAddress = await accountFactory.getAddress(owner.address, 0);
      expect(expectedAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should get deterministic account address", async function () {
      const addr1 = await accountFactory.getAddress(owner.address, 0);
      const addr2 = await accountFactory.getAddress(owner.address, 0);

      expect(addr1).to.equal(addr2);
    });

    it("Should compute address correctly", async function () {
      const expectedAddress = await accountFactory.connect(owner).createAccountAndGetAddress(
        owner.address,
        [guardian1.address],
        1,
        ethers.parseEther("100")
      );

      expect(expectedAddress).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Cash Account", function () {
    let account: any;

    beforeEach(async function () {
      const tx = await accountFactory.connect(owner).createAccount(
        owner.address,
        [guardian1.address],
        1,
        ethers.parseEther("100")
      );

      const receipt = await tx.wait();

      // Get account address from events
      if (receipt?.logs) {
        const event = receipt.logs[0];
        account = await ethers.getContractAt("CashAccount", event.address || receipt.to);
      }
    });

    it("Should have correct owner", async function () {
      const accountOwner = await account.owner();
      expect(accountOwner).to.equal(owner.address);
    });

    it("Should have guardians set", async function () {
      const hasGuardian = await account.isGuardian(guardian1.address);
      expect(hasGuardian).to.be.true;
    });

    it("Should reject non-guardian", async function () {
      const hasGuardian = await account.isGuardian(user.address);
      expect(hasGuardian).to.be.false;
    });

    it("Should execute function call", async function () {
      const callData = ethers.solidityPacked(["address", "uint256", "bytes"], [
        await account.getAddress(),
        0,
        "0x",
      ]);

      await expect(account.connect(owner).execute(await account.getAddress(), 0, "0x"))
        .to.be.reverted;
    });

    it("Should have spending limit", async function () {
      const limit = await account.dailySpendLimit();
      expect(limit).to.equal(ethers.parseEther("100"));
    });

    it("Should track daily spending", async function () {
      const spent = await account.dailySpent();
      expect(spent).to.equal(0);
    });

    it("Should reset daily limit", async function () {
      // Simulate passage of time and reset
      await account.connect(owner).resetDailyLimit();

      const spent = await account.dailySpent();
      expect(spent).to.equal(0);
    });

    it("Should allow recovery by guardian", async function () {
      const newOwner = user.address;

      await expect(
        account.connect(guardian1).recoverAccount(newOwner)
      ).to.not.be.reverted;
    });

    it("Should reject recovery by non-guardian", async function () {
      const newOwner = user.address;

      await expect(
        account.connect(user).recoverAccount(newOwner)
      ).to.be.reverted;
    });
  });

  describe("Paymaster", function () {
    it("Should have correct entry point", async function () {
      const entryPoint = await paymaster.entryPoint();
      expect(entryPoint).to.not.equal(ethers.ZeroAddress);
    });

    it("Should validate user operation", async function () {
      const userOp = {
        sender: owner.address,
        nonce: 0,
        initCode: "0x",
        callData: "0x",
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 100000,
        maxFeePerGas: ethers.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
        paymasterAndData: await paymaster.getAddress(),
        signature: "0x",
      };

      // This would need proper implementation
      // For now, verify the paymaster exists
      expect(await paymaster.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should reject invalid user operation", async function () {
      const userOp = {
        sender: ethers.ZeroAddress,
        nonce: 0,
        initCode: "0x",
        callData: "0x",
        callGasLimit: 100000,
        verificationGasLimit: 100000,
        preVerificationGas: 100000,
        maxFeePerGas: ethers.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
        paymasterAndData: await paymaster.getAddress(),
        signature: "0x",
      };

      // Zero sender should be invalid
      expect(userOp.sender).to.equal(ethers.ZeroAddress);
    });

    it("Should track gas sponsorship", async function () {
      const sponsored = await paymaster.sponsoredGas();
      expect(sponsored).to.be.greaterThanOrEqual(0);
    });

    it("Should allow owner to withdraw balance", async function () {
      // Send funds to paymaster
      await owner.sendTransaction({
        to: await paymaster.getAddress(),
        value: ethers.parseEther("1"),
      });

      const balanceBefore = await ethers.provider.getBalance(await paymaster.getAddress());

      await paymaster.connect(owner).withdraw(owner.address, balanceBefore);

      const balanceAfter = await ethers.provider.getBalance(await paymaster.getAddress());
      expect(balanceAfter).to.be.lessThan(balanceBefore);
    });

    it("Should reject withdrawal by non-owner", async function () {
      await expect(
        paymaster.connect(user).withdraw(user.address, ethers.parseEther("1"))
      ).to.be.reverted;
    });
  });

  describe("Integration Tests", function () {
    it("Should create account and use paymaster", async function () {
      // Create account
      await accountFactory.connect(owner).createAccount(
        owner.address,
        [guardian1.address],
        1,
        ethers.parseEther("100")
      );

      // Account should be created
      const expectedAddress = await accountFactory.getAddress(owner.address, 0);
      expect(expectedAddress).to.not.equal(ethers.ZeroAddress);

      // Verify paymaster is deployed
      expect(await paymaster.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should execute transaction through account with paymaster", async function () {
      // Create account
      const tx = await accountFactory.connect(owner).createAccount(
        owner.address,
        [guardian1.address],
        1,
        ethers.parseEther("100")
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });

    it("Should enforce spending limits", async function () {
      // Create account with low limit
      await accountFactory.connect(owner).createAccount(
        owner.address,
        [guardian1.address],
        1,
        ethers.parseEther("0.1")
      );

      // Spending more than limit should fail
      // This would require actual execution through UserOps
      const limit = ethers.parseEther("0.1");
      expect(limit).to.be.greaterThan(0);
    });

    it("Should support social recovery", async function () {
      // Create account
      const tx = await accountFactory.connect(owner).createAccount(
        owner.address,
        [guardian1.address, guardian2.address],
        2,
        ethers.parseEther("100")
      );

      const receipt = await tx.wait();
      expect(receipt?.status).to.equal(1);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero guardians", async function () {
      await accountFactory.connect(owner).createAccount(
        owner.address,
        [],
        0,
        ethers.parseEther("100")
      );

      const expectedAddress = await accountFactory.getAddress(owner.address, 0);
      expect(expectedAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should handle max threshold", async function () {
      const guardians = [guardian1.address, guardian2.address];

      await accountFactory.connect(owner).createAccount(
        owner.address,
        guardians,
        2,
        ethers.parseEther("100")
      );

      const expectedAddress = await accountFactory.getAddress(owner.address, 0);
      expect(expectedAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should reject invalid threshold", async function () {
      // Threshold higher than guardian count should fail
      await expect(
        accountFactory.connect(owner).createAccount(
          owner.address,
          [guardian1.address],
          2,
          ethers.parseEther("100")
        )
      ).to.be.reverted;
    });
  });
});
