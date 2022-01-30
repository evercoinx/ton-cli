#!/usr/bin/env node
import "dotenv/config"
import yargs, { Argv } from "yargs"
import { hideBin } from "yargs/helpers"
import TonWeb from "tonweb"

import WalletManager from "./manager/wallet"
import LotteryManager from "./manager/lottery"

const { HttpProvider } = TonWeb
const provider = new HttpProvider(process.env.HTTP_PROVIDER_HOST)
const tonweb = new TonWeb(provider)

tonweb.wallet.defaultVersion = "v3R2"
;(async () => {
	const walletManager = new WalletManager(tonweb)
	const lotteryManager = new LotteryManager(tonweb)

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
				const { wc } = argv
				await walletManager.prepare(wc)
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
				const { address } = argv
				await walletManager.deploy(address)
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
				const { address } = argv
				await walletManager.info(address)
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
				const { sender, recipient, amount, stateinit, memo } = argv
				await walletManager.transfer(
					sender,
					recipient,
					amount,
					stateinit,
					memo,
				)
			},
		})
		.command({
			command: "lotteryprepare [wc]",
			aliases: ["lp"],
			describe: "Prepare lottery",
			builder: (yargs: Argv) =>
				yargs
					.positional("wc", {
						describe: "Workchain id. Defaults to 0",
						default: 0,
					})
					.coerce("wc", (opt: string) => parseInt(opt)),
			handler: async (argv: any) => {
				const { wc } = argv
				await lotteryManager.prepare(wc)
			},
		})
		.command({
			command: "lotterydeploy <address>",
			aliases: ["ld"],
			describe: "Deploy lottery",
			builder: (yargs: Argv) =>
				yargs.positional("address", {
					describe: "Lottery address",
				}),
			handler: async (argv: any) => {
				const { address } = argv
				await lotteryManager.deploy(address)
			},
		})
		.command({
			command: "lotteryinfo <address>",
			aliases: ["li"],
			describe: "Get lottery information",
			builder: (yargs: Argv) =>
				yargs.positional("address", {
					describe: "Wallet address",
				}),
			handler: async (argv: any) => {
				const { address } = argv
				await lotteryManager.info(address)
			},
		})
		.strictCommands()
		.demandCommand(1)
		.help().argv
})()
