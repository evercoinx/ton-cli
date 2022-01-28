#!/usr/bin/env node

require("dotenv").config()
const yargs = require("yargs/yargs")
const { hideBin } = require("yargs/helpers")
const TonWeb = require("tonweb")
const Wallet = require("../internal/wallet.js")

const { HttpProvider } = TonWeb
const provider = new HttpProvider(process.env.HTTP_PROVIDER_HOST)
const tonweb = new TonWeb(provider)
tonweb.wallet.defaultVersion = "v3R2"

const wallet = new Wallet(tonweb)

;(async () => {
    yargs(hideBin(process.argv))
        .usage("$0 <cmd> [args]")
        .command({
            command: "walletpredeploy [wc]",
            aliases: ["wp"],
            describe: "Predeploy wallet",
            builder: yargs =>
                yargs
                    .positional("wc", {
                        describe: "Workchain id. Defaults to 0",
                        default: 0,
                    })
                    .coerce("wc", opt => parseInt(opt)),
            handler: async argv => {
                const { wc } = argv
                await wallet.predeploy(wc)
            },
        })
        .command({
            command: "walletdeploy <address>",
            aliases: ["wd"],
            describe: "Deploy wallet",
            builder: yargs =>
                yargs.positional("address", {
                    describe: "Wallet address",
                }),
            handler: async argv => {
                const { address } = argv
                await wallet.deploy(address)
            },
        })
        .command({
            command: "walletinfo <address>",
            aliases: ["wi"],
            describe: "Get wallet information",
            builder: yargs =>
                yargs.positional("address", {
                    describe: "Wallet address",
                }),
            handler: async argv => {
                const { address } = argv
                await wallet.info(address)
            },
        })
        .command({
            command:
                "wallettransfer <sender> <recipient> <amount> [stateinit] [memo]",
            aliases: ["wt"],
            describe: "Transfer toncoins",
            builder: yargs =>
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
                    .coerce("amount", opt => parseFloat(opt))
                    .positional("stateinit", {
                        describe:
                            "Check if address should be non-bounceable for stateinit operation",
                        default: false,
                    })
                    .coerce("stateinit", opt => !!parseInt(opt))
                    .positional("memo", {
                        describe: "Transaction memo",
                        default: "",
                    }),
            handler: async argv => {
                const { sender, recipient, amount, stateinit, memo } = argv
                await wallet.transfer(
                    sender,
                    recipient,
                    amount,
                    stateinit,
                    memo,
                )
            },
        })
        .strictCommands()
        .demandCommand(1)
        .help().argv
})()
