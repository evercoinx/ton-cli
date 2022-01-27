#!/usr/bin/env node

require("dotenv").config();
const yargs = require("yargs/yargs");
const TonWeb = require("tonweb");
const Wallet = require("../internal/wallet.js");

const { HttpProvider } = TonWeb;
const provider = new HttpProvider(process.env.HTTP_PROVIDER_HOST);
const tonweb = new TonWeb(provider);
tonweb.wallet.defaultVersion = "v3R2";

const wallet = new Wallet(tonweb);

(async () => {
  yargs(process.argv.slice(2))
    .command({
      command: "walletinfo <address>",
      aliases: ["wi"],
      desc: "Get wallet information",
      handler: async (argv) => {
        const { address } = argv;
        await wallet.info(address);
      },
    })
    .command({
      command: "wallettransfer <sender> <recipient> <amount>",
      aliases: ["wt"],
      desc: "Transfer toncoins",
      handler: async (argv) => {
        const { sender, recipient, amount } = argv;
        await wallet.transfer(sender, recipient, parseFloat(amount));
      },
    })
    .demandCommand()
    .help().argv;
})();
