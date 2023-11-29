const {ethers} = require("hardhat");
const {expect, assert} = require("chai");

describe("NFTMarket Test", () => {
  let nftMarket;
  let signers;

  beforeEach(async () => {
    const NFTMarket = await ethers.getContractFactory("NFTMarket");
    nftMarket = await NFTMarket.deploy();
    await nftMarket.deployed();

    signers = await ethers.getSigners();
  });

  const createNFT = async (tokenURI) => {
    const transaction = await nftMarket.createNFT(tokenURI);
    const receipt = await transaction.wait();
    const tokenID = receipt.events[0].args.tokenId;
    return tokenID;
  };

  const createAndListNFT = async (tokenURI, tokenListingPrice) => {
    const transaction1 = await nftMarket.createNFT(tokenURI);
    const receipt = await transaction1.wait();
    const tokenID = receipt.events[0].args.tokenId;
    const transaction2 = await nftMarket.listNFT(tokenID, tokenListingPrice);
    await transaction2.wait();

    return tokenID;
  };

  describe("CreateNFT", () => {
    it("Should create a new NFT with the correct owner and tokenURI", async () => {
      const tokenURI = "https://github.com/rohitroy-github";
      // const tokenID = await createNFT(tokenURI);
      const transaction = await nftMarket.createNFT(tokenURI);
      const receipt = await transaction.wait();
      const tokenID = receipt.events[0].args.tokenId;

      const mintedTokenURI = await nftMarket.tokenURI(tokenID);
      expect(mintedTokenURI).to.equal(tokenURI);

      const ownerAddress = await nftMarket.ownerOf(tokenID);
      const currentAddress = await signers[0].getAddress();
      expect(ownerAddress).to.equal(currentAddress);

      const args = receipt.events[1].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.to).to.equal(ownerAddress);
      expect(args.from).to.equal(ethers.constants.AddressZero);
      expect(args.tokenURI).to.equal(tokenURI);
      expect(args.price).to.equal(0);
    });
  });

  describe("ListNFT", () => {
    const tokenURI = "https://github.com/rohitroy-github";
    const tokenListingPrice = 100;

    it("Should revert is price is less than 0.", async () => {
      const tokenID = await createNFT(tokenURI);
      const transaction = nftMarket.listNFT(tokenID, 0);

      await expect(transaction).to.be.revertedWith(
        "NFTMarket: Price must be greater than 0 !"
      );
    });

    it("Should revert if not called by the owner.", async () => {
      const tokenID = await createNFT(tokenURI);
      const transaction = nftMarket.connect(signers[1]).listNFT(tokenID, 5);

      await expect(transaction).to.be.revertedWith(
        "ERC721: transfer caller is not owner nor approved"
      );
    });

    it("It should list the token for sale if all requirements are met.", async () => {
      const tokenID = await createNFT(tokenURI);
      const transaction = await nftMarket.listNFT(tokenID, tokenListingPrice);
      const receipt = await transaction.wait();
      const args = receipt.events[2].args;

      expect(args.tokenID).to.equal(tokenID);
      expect(args.to).to.equal(nftMarket.address);
      expect(args.from).to.equal(signers[0].address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(tokenListingPrice);
    });
  });

  describe("BuyNFT ", () => {
    const tokenURI = "https://github.com/rohitroy-github";
    const tokenListingPrice = 100;
    const sellerProfit = Math.floor((tokenListingPrice * 95) / 100);
    const fee = tokenListingPrice - sellerProfit;

    it("It should revert if NFT is not listed for sale.", async () => {
      const transaction = nftMarket.buyNFT(99999);

      await expect(transaction).to.be.revertedWith(
        "NFTMarket: NFT not listed for sale !"
      );
    });

    it("It should revert if amount sent for buying if not equal to the listing price.", async () => {
      const tokenID = await createAndListNFT(tokenURI, tokenListingPrice);
      const transaction = nftMarket.buyNFT(tokenID, {value: 50});

      expect(transaction).to.be.revertedWith("NFTMarket: Incorrect price !");
    });

    it("should transfer ownership to the buyer and send the price to the seller", async () => {
      const initialContractBalance = await nftMarket.provider.getBalance(
        nftMarket.address
      );
      const tokenID = await createAndListNFT(tokenURI, tokenListingPrice);
      await new Promise((r) => setTimeout(r, 100));
      const oldSellerBalance = await signers[0].getBalance();
      const transaction = await nftMarket
        .connect(signers[1])
        .buyNFT(tokenID, {value: tokenListingPrice});
      const receipt = await transaction.wait();
      // 95% of the price was added to the seller balance
      await new Promise((r) => setTimeout(r, 100));
      const newSellerBalance = await signers[0].getBalance();
      const diff = newSellerBalance.sub(oldSellerBalance);
      expect(diff).to.equal(sellerProfit);
      // 5% of the price was kept in the contract balance
      const newContractBalance = await nftMarket.provider.getBalance(
        nftMarket.address
      );
      const contractBalanceDiff = newContractBalance.sub(
        initialContractBalance
      );
      expect(contractBalanceDiff).to.equal(fee);
      // checkingForOwnershipTransfer
      const ownerAddress = await nftMarket.ownerOf(tokenID);
      expect(ownerAddress).to.equal(signers[1].address);
      // checkingForEventEmittedDetails
      const args = receipt.events[2].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.to).to.equal(signers[1].address);
      expect(args.from).to.equal(nftMarket.address);
      expect(args.tokenURI).to.equal("");
      expect(args.price).to.equal(0);
    });
  });

  describe("CancelListing ", () => {
    const tokenURI = "https://github.com/rohitroy-github";
    const tokenListingPrice = 5;

    it("It should revert it NFT is not listed for sale.", async () => {
      const transacrion = nftMarket.cancelListing(99999);
      await expect(transacrion).to.be.revertedWith(
        "NFTMarket: NFT not listed for sale !"
      );
    });

    it("It should revert caller is not the seller of the listing.", async () => {
      const tokenID = await createAndListNFT(tokenURI, tokenListingPrice);
      const transacrion = nftMarket.connect(signers[1]).cancelListing(tokenID);
      await expect(transacrion).to.be.revertedWith(
        "NFTMarket: Only owner is allowed to cancel the listing !"
      );
    });

    it("It should transfer the ownership back to the seller if all the requirements are met !", async () => {
      const tokenID = await createAndListNFT(tokenURI, 5);
      const transaction = await nftMarket.cancelListing(tokenID);
      const receipt = await transaction.wait();
      const ownerAddress = await nftMarket.ownerOf(tokenID);
      expect(ownerAddress).to.equal(signers[0].address);
      // checkingForEventEmittedDetails
      const args = receipt.events[2].args;
      expect(args.tokenID).to.equal(tokenID);
      expect(args.to).to.equal(signers[0].address);
      expect(args.tokenURI).to.equal("");
      expect(args.from).to.equal(nftMarket.address);
      expect(args.price).to.equal(0);
    });
  });

  describe("WithdrawFunds ", () => {
    const tokenURI = "https://github.com/rohitroy-github";
    const tokenListingPrice = 100;

    it("It should revert if called by a signer other than the contract owner !", async () => {
      const transaction = nftMarket.connect(signers[1]).withdrawFunds();
      await expect(transaction).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("It should revert balance is less than 0 !", async () => {
      const tokenID = await createAndListNFT(tokenURI, tokenListingPrice);
      const transaction = await nftMarket
        .connect(signers[1])
        .buyNFT(tokenID, {value: tokenListingPrice});

      await new Promise((r) => setTimeout(r, 100));

      const contractBalance = await nftMarket.provider.getBalance(
        nftMarket.address
      );
      const initialOwnerBalance = await signers[0].getBalance();
      const transaction2 = await nftMarket.withdrawFunds();
      const receipt = await transaction2.wait();

      await new Promise((r) => setTimeout(r, 100));
      const newOwnerBalance = await signers[0].getBalance();

      const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const transferred = newOwnerBalance.add(gas).sub(initialOwnerBalance);
      expect(transferred).to.equal(contractBalance);
    });

    it("should revert if contract balance is zero", async () => {
      const transaction = nftMarket.withdrawFunds();
      await expect(transaction).to.be.revertedWith(
        "NFTMarket: Balance is less than 0 !"
      );
    });
  });
});
