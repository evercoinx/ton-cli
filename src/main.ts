#!/usr/bin/env node
import "dotenv/config";
import yargs, { Argv } from "yargs";
import { hideBin } from "yargs/helpers";
import TonWeb from "tonweb";

import Wallet from "./wallet";

const { HttpProvider } = TonWeb;
const provider = new HttpProvider(process.env.HTTP_PROVIDER_HOST);
const tonweb = new TonWeb(provider);

tonweb.wallet.defaultVersion = "v3R2";

(async () => {
    const wallet = new Wallet(tonweb);

    yargs(hideBin(process.argv))
        .usage("$0 <cmd> [args]")
        .command({
            command: "walletprepare [wc]",
            aliases: ["wp"],
            describe: "Prepare wallet",
            builder: (yargs: Argv) =>
                yargs
                    .positional("wc", {
                        describe: "Workchain id. Defaults to 0",
                        default: 0,
                    })
                    .coerce("wc", (opt: string) => parseInt(opt)),
            handler: async (argv: any) => {
                const { wc } = argv;
                await wallet.prepare(wc);
            },
        })
        .command({
            command: "walletdeploy <address>",
            aliases: ["wd"],
            describe: "Deploy wallet",
            builder: (yargs: Argv) =>
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
            builder: (yargs: Argv) =>
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
            builder: (yargs: Argv) =>
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
                    .coerce("amount", (opt: string) => parseFloat(opt))
                    .positional("stateinit", {
                        describe:
                            "Check if address should be non-bounceable for stateinit operation",
                        default: false,
                    })
                    .coerce("stateinit", (opt: string) => !!parseInt(opt))
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
