const fs = require("fs").promises;
const tonMnemonic = require("tonweb-mnemonic");
const { BN } = require("tonweb").utils;
const mnemonicData = require("../mnemonic.json");

class Wallet {
  constructor(tonweb, workchain) {
    this.tonweb = tonweb;
    this.workchain = workchain;
  }

  async predeploy() {
    try {
      const walletMnemonic = await tonMnemonic.generateMnemonic();
      const keyPair = await tonMnemonic.mnemonicToKeyPair(walletMnemonic);

      const wallet = this.tonweb.wallet.create({
        publicKey: keyPair.publicKey,
        wc: this.workchain,
      });

      const address = await wallet.getAddress();
      const bouncableAddress = address.toString(true, true, true);
      mnemonicData[bouncableAddress] = walletMnemonic;
      await fs.writeFile(
        "mnemonic.json",
        JSON.stringify(mnemonicData, null, 4)
      );

      const deployRequest = await wallet.deploy(keyPair.secretKey);

      const feeResponse = await deployRequest.estimateFee();
      this.printFees(feeResponse);

      const nonBouncableAddress = address.toString(true, true, false);
      console.log(`Wallet is ready to be deployed at ${nonBouncableAddress}`);
    } catch (err) {
      console.error(`Error! ${err}`);
    }
  }

  async deploy(walletAddress) {
    try {
      const walletMnemonic = mnemonicData[walletAddress];
      if (!walletMnemonic) {
        console.error(`Error! Wallet mnemonic is not found`);
        return;
      }

      const validMnemonic = await tonMnemonic.validateMnemonic(walletMnemonic);
      if (!validMnemonic) {
        console.error(`Error! Mnemonic is invalid`);
        return;
      }

      const keyPair = await tonMnemonic.mnemonicToKeyPair(walletMnemonic);

      const wallet = this.tonweb.wallet.create({
        publicKey: keyPair.publicKey,
        wc: this.workchain,
      });

      const deployRequest = await wallet.deploy(keyPair.secretKey);

      const feeResponse = await deployRequest.estimateFee();
      this.printFees(feeResponse);

      const response = await deployRequest.send();
      this.printResponse(response, `Wallet was deployed successfully`);
    } catch (err) {
      console.error(`Error! ${err}`);
    }
  }

  async info(walletAddress) {
    try {
      const wallet = this.tonweb.wallet.create({ address: walletAddress });

      const address = await wallet.getAddress();
      const seqno = await wallet.methods.seqno().call();
      const balance = await this.tonweb.getBalance(walletAddress);

      console.log("\nWallet information:");
      console.log(`- Raw address: ${address.toString(false, true, true)}`);
      console.log(`- Bouncable address: ${address.toString(true, true, true)}`);
      console.log(
        `- Non bouncable address: ${address.toString(true, true, false)}`
      );
      console.log(`- Balance: ${this.formatAmount(balance)}`);
      console.log(`- Sequence number: ${seqno}`);
    } catch (err) {
      console.error(`Error! ${err}`);
    }
  }

  async transfer(sender, recipient, amount) {
    try {
      const senderMnemonic = mnemonicData[sender];
      if (!senderMnemonic) {
        console.error(`Error! Sender mnemonic is not found`);
        return;
      }

      const validMnemonic = await tonMnemonic.validateMnemonic(senderMnemonic);
      if (!validMnemonic) {
        console.error(`Error! Mnemonic is invalid`);
        return;
      }

      const keyPair = await tonMnemonic.mnemonicToKeyPair(senderMnemonic);

      const wallet = this.tonweb.wallet.create({
        publicKey: keyPair.publicKey,
        wc: this.workchain,
      });

      const amountNano = this.tonweb.utils.toNano(amount);
      const senderBalance = await this.tonweb.getBalance(sender);
      if (amountNano.gt(new BN(senderBalance))) {
        console.error(
          `Error! Transfer amount ${this.formatAmount(
            amountNano
          )} exceeds balance ${this.formatAmount(senderBalance)}`
        );
        return;
      }

      const seqno = await wallet.methods.seqno().call();
      const transferRequest = wallet.methods.transfer({
        secretKey: keyPair.secretKey,
        toAddress: recipient,
        amount: amountNano,
        seqno: seqno,
        payload: "Transfer",
        sendMode: 3,
      });

      const feeResponse = await transferRequest.estimateFee();
      this.printFees(feeResponse);

      const transferResponse = await transferRequest.send();
      this.printResponse(
        transferResponse,
        `${this.formatAmount(amountNano)} were transferred successfully`
      );
    } catch (err) {
      console.error(`Error! ${err}`);
    }
  }

  formatAmount(amount) {
    return `${this.tonweb.utils.fromNano(amount)} TON`;
  }

  printFees(response) {
    if (response["@type"] !== "query.fees") {
      console.error(
        `Error! Code: ${response.code}, message: ${response.message}`
      );
      return;
    }

    const fees = response["source_fees"];
    console.log(`Fees:`);
    console.log(`- Gas fee:        ${this.formatAmount(fees["gas_fee"])}`);
    console.log(`- In-Forward fee: ${this.formatAmount(fees["in_fwd_fee"])}`);
    console.log(`- Forward fee:    ${this.formatAmount(fees["fwd_fee"])}`);
    console.log(`- Storage fee:    ${this.formatAmount(fees["storage_fee"])}`);
  }

  printResponse(response, successMessage) {
    if (response["@type"] !== "ok") {
      console.error(
        `Error! Code: ${response.code}, message: ${response.message}`
      );
      return;
    }
    console.log(successMessage);
  }
}

module.exports = Wallet;
