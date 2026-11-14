const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MezoPayInvoices", function () {
  const amount = ethers.parseUnits("25", 18);

  async function fixture() {
    const [creator, payer, other] = await ethers.getSigners();
    const token = await ethers.deployContract("MockERC20");
    const invoices = await ethers.deployContract("MezoPayInvoices", [await token.getAddress()]);
    await token.mint(payer.address, amount * 3n);
    return { creator, payer, other, token, invoices };
  }

  async function createdFixture() {
    const state = await fixture();
    await state.invoices.createInvoice(amount, "Design work", "November invoice");
    return state;
  }

  it("starts empty and stores the MUSD address", async function () {
    const { creator, token, invoices } = await loadFixture(fixture);
    expect(await invoices.musdToken()).to.equal(await token.getAddress());
    expect(await invoices.totalInvoices()).to.equal(0);
    expect(await invoices.getCreatorInvoices(creator.address)).to.deep.equal([]);
    expect(await invoices.getPayerInvoices(creator.address)).to.deep.equal([]);
  });

  it("rejects a zero token address", async function () {
    await expect(ethers.deployContract("MezoPayInvoices", [ethers.ZeroAddress]))
      .to.be.revertedWith("Invalid MUSD token");
  });

  it("returns the ID, emits creation, and stores every invoice field", async function () {
    const { creator, invoices } = await loadFixture(fixture);
    expect(await invoices.createInvoice.staticCall(amount, "Design work", "November invoice")).to.equal(1);
    await expect(invoices.createInvoice(amount, "Design work", "November invoice"))
      .to.emit(invoices, "InvoiceCreated").withArgs(1, creator.address, amount, "Design work");
    expect(await invoices.getInvoice(1)).to.deep.equal([
      1n, creator.address, ethers.ZeroAddress, amount, "Design work", "November invoice",
      false, BigInt(await time.latest()), 0n,
    ]);
    expect(await invoices.totalInvoices()).to.equal(1);
    expect(await invoices.getCreatorInvoices(creator.address)).to.deep.equal([1n]);
  });

  it("rejects zero amounts and empty titles without creating invoices", async function () {
    const { invoices } = await loadFixture(fixture);
    await expect(invoices.createInvoice(0, "Title", "")).to.be.revertedWith("Amount must be positive");
    await expect(invoices.createInvoice(amount, "", "Memo")).to.be.revertedWith("Title is required");
    expect(await invoices.totalInvoices()).to.equal(0);
  });

  it("settles 100% directly to the creator and records payment", async function () {
    const { creator, payer, token, invoices } = await loadFixture(createdFixture);
    const createdAt = (await invoices.getInvoice(1)).createdAt;
    await token.connect(payer).approve(await invoices.getAddress(), amount);
    await expect(invoices.connect(payer).payInvoice(1))
      .to.emit(invoices, "InvoicePaid").withArgs(1, creator.address, payer.address, amount)
      .and.to.changeTokenBalances(token, [payer, creator, invoices], [-amount, amount, 0n]);
    const invoice = await invoices.getInvoice(1);
    expect(invoice.paid).to.equal(true);
    expect(invoice.payer).to.equal(payer.address);
    expect(invoice.paidAt).to.equal(await time.latest());
    expect(invoice.createdAt).to.equal(createdAt);
    expect(await invoices.getPayerInvoices(payer.address)).to.deep.equal([1n]);
    expect(await invoices.totalInvoices()).to.equal(1);
  });

  it("prevents double payment by any payer", async function () {
    const { payer, other, token, invoices } = await loadFixture(createdFixture);
    await token.connect(payer).approve(await invoices.getAddress(), amount * 2n);
    await invoices.connect(payer).payInvoice(1);
    await expect(invoices.connect(payer).payInvoice(1)).to.be.revertedWith("Invoice already paid");
    await expect(invoices.connect(other).payInvoice(1)).to.be.revertedWith("Invoice already paid");
    expect(await invoices.getPayerInvoices(payer.address)).to.deep.equal([1n]);
  });

  it("rejects nonexistent invoices including ID zero", async function () {
    const { invoices } = await loadFixture(fixture);
    for (const id of [0, 1, 999]) {
      await expect(invoices.getInvoice(id)).to.be.revertedWith("Invoice does not exist");
      await expect(invoices.payInvoice(id)).to.be.revertedWith("Invoice does not exist");
    }
  });

  it("keeps failed payments unpaid and permits a later retry", async function () {
    const { payer, token, invoices } = await loadFixture(createdFixture);
    await expect(invoices.connect(payer).payInvoice(1)).to.be.revertedWith("Insufficient allowance");
    await token.connect(payer).approve(await invoices.getAddress(), amount);
    await token.setFailTransfers(true);
    await expect(invoices.connect(payer).payInvoice(1)).to.be.revertedWith("MUSD transfer failed");
    const invoice = await invoices.getInvoice(1);
    expect(invoice.paid).to.equal(false);
    expect(invoice.payer).to.equal(ethers.ZeroAddress);
    expect(invoice.paidAt).to.equal(0);
    expect(await invoices.getPayerInvoices(payer.address)).to.deep.equal([]);
    await token.setFailTransfers(false);
    await invoices.connect(payer).payInvoice(1);
    expect((await invoices.getInvoice(1)).paid).to.equal(true);
  });

  it("rejects insufficient balance without recording payment", async function () {
    const { other, token, invoices } = await loadFixture(createdFixture);
    await token.connect(other).approve(await invoices.getAddress(), amount);
    await expect(invoices.connect(other).payInvoice(1)).to.be.revertedWith("Insufficient balance");
    expect((await invoices.getInvoice(1)).paid).to.equal(false);
    expect(await invoices.getPayerInvoices(other.address)).to.deep.equal([]);
  });

  it("indexes sequential invoices by creator and payer independently", async function () {
    const { creator, payer, other, token, invoices } = await loadFixture(createdFixture);
    await invoices.connect(other).createInvoice(amount, "Second", "");
    await invoices.createInvoice(amount, "Third", "");
    await token.connect(payer).approve(await invoices.getAddress(), amount * 2n);
    await invoices.connect(payer).payInvoice(2);
    await invoices.connect(payer).payInvoice(1);
    expect(await invoices.totalInvoices()).to.equal(3);
    expect(await invoices.getCreatorInvoices(creator.address)).to.deep.equal([1n, 3n]);
    expect(await invoices.getCreatorInvoices(other.address)).to.deep.equal([2n]);
    expect(await invoices.getPayerInvoices(payer.address)).to.deep.equal([2n, 1n]);
    expect(await invoices.getPayerInvoices(other.address)).to.deep.equal([]);
    expect((await invoices.getInvoice(3)).memo).to.equal("");
  });
});
