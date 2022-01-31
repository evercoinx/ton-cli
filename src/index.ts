#!/usr/bin/env node
import "dotenv/config"
import yargs, { Argv } from "yargs"
import { hideBin } from "yargs/helpers"
import TonWeb from "tonweb"

import WalletManager from "./manager/wallet"
import ExampleManager from "./manager/example"
import Example from "./contract/example"

const { HttpProvider, Wallets } = TonWeb
const provider = new HttpProvider(process.env.HTTP_PROVIDER_HOST || "")
const tonweb = new TonWeb(provider)

const wallets = new Wallets(provider)
const walletManager = new WalletManager(tonweb, wallets.all.v3R2)
const exampleManager = new ExampleManager(tonweb, Example as any)

const contractToManager = {
	wallet: walletManager,
	example: exampleManager,
}

const createPrepareCommand = (contract: string) => ({
	command: `${contract}prepare [wc]`,
	aliases: [`${contract[0]}p`],
	describe: `Prepare ${contract}`,
	builder: (yargs: Argv) =>
		yargs
			.positional("wc", {
				describe: "Workchain id. Defaults to 0",
				default: 0,
			})
			.coerce("wc", (opt: string) => parseInt(opt)),
	handler: async (argv: any) => {
		const { wc } = argv
		await contractToManager[contract].prepare(wc)
	},
})

const createDeployCommand = (contract: string) => ({
	command: `${contract}deploy <address>`,
	aliases: [`${contract[0]}d`],
	describe: `Deploy ${contract}`,
	builder: (yargs: Argv) =>
		yargs.positional("address", {
			describe: "Contract address",
		}),
	handler: async (argv: any) => {
		const { address } = argv
		await contractToManager[contract].deploy(address)
	},
})

const createInfoCommand = (contract: string) => ({
	command: `${contract}info <address>`,
	aliases: [`${contract[0]}i`],
	describe: `Get ${contract} information`,
	builder: (yargs: Argv) =>
		yargs.positional("address", {
			describe: "Contract address",
		}),
	handler: async (argv: any) => {
		const { address } = argv
		await contractToManager[contract].info(address)
	},
})

const walletContract = "wallet"
const exampleContract = "example"

;(async () => {
	yargs(hideBin(process.argv))
		.usage("$0 <cmd> [args]")
		.command(createPrepareCommand(walletContract))
		.command(createDeployCommand(walletContract))
		.command(createInfoCommand(walletContract))
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
		.command(createPrepareCommand(exampleContract))
		.command(createDeployCommand(exampleContract))
		.command(createInfoCommand(exampleContract))
		.strictCommands()
		.demandCommand(1)
		.help().argv
})()
