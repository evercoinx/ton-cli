#!/usr/bin/env node

require("dotenv").config();
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const TonWeb2 = require("tonweb");
const Wallet2 = require("./wallet.js");

const { HttpProvider } = TonWeb2;
const provider = new HttpProvider(process.env.HTTP_PROVIDER_HOST);
const tonweb = new TonWeb2(provider);
tonweb.wallet.defaultVersion = "v3R2";

const wallet = new Wallet2(tonweb);

(async () => {
    yargs(hideBin(process.argv))
        .usage("$0 <cmd> [args]")
        .command({
            command: "walletpredeploy [wc]",
            aliases: ["wp"],
            describe: "Predeploy wallet",
            builder: (yargs: any) =>
                yargs
                    .positional("wc", {
                        describe: "Workchain id. Defaults to 0",
                        default: 0,
                    })
                    .coerce("wc", (opt: string) => parseInt(opt)),
            handler: async (argv: any) => {
                const { wc } = argv;
                await wallet.predeploy(wc);
            },
        })
        .command({
            command: "walletdeploy <address>",
            aliases: ["wd"],
            describe: "Deploy wallet",
            builder: (yargs: any) =>
                yargs.positional("address", {
                    describe: "Wallet address",
                }),
            handler: async (argv: any) => {
                const { address } = argv;
                await wallet.deploy(address);
            },
        })
        .command({
            command: "walletinfo <address>",
            aliases: ["wi"],
            describe: "Get wallet information",
            builder: (yargs: any) =>
                yargs.positional("address", {
                    describe: "Wallet address",
                }),
            handler: async (argv: any) => {
                const { address } = argv;
                await wallet.info(address);
            },
        })
        .command({
            command:
                "wallettransfer <sender> <recipient> <amount> [stateinit] [memo]",
            aliases: ["wt"],
            describe: "Transfer toncoins",
            builder: (yargs: any) =>
                yargs
                    .positional("sender", {
                        describe: "Sender's wallet address",
                    })
                    .positional("recipient", {
                        describe: "Recipients's wallet address",
                    })
                    .positional("amount", {
                        describe: "Amount to transfer",
                    })
                    .coerce("amount", (opt: any) => parseFloat(opt))
                    .positional("stateinit", {
                        describe:
                            "Check if address should be non-bounceable for stateinit operation",
                        default: false,
                    })
                    .coerce("stateinit", (opt: any) => !!parseInt(opt))
                    .positional("memo", {
                        describe: "Transaction memo",
                        default: "",
                    }),
            handler: async (argv: any) => {
                const { sender, recipient, amount, stateinit, memo } = argv;
                await wallet.transfer(
                    sender,
                    recipient,
                    amount,
                    stateinit,
                    memo,
                );
            },
        })
        .strictCommands()
        .demandCommand(1)
        .help().argv;
})();
