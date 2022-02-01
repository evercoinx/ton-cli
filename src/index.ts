#!/usr/bin/env node
import "dotenv/config"
import joi from "joi"
import TonWeb, { HttpProvider, Wallets } from "tonweb"
import yargs, { Argv } from "yargs"
import { hideBin } from "yargs/helpers"

import Example from "./contract/example"
import createLogger from "./logger"
import WalletManager from "./manager/wallet"
import ExampleManager from "./manager/example"

const schema = joi
	.object()
	.keys({
		NODE_ENV: joi.string().valid("production", "development").required(),
		NODE_HTTP_PROVIDER_HOST: joi.string().uri().required(),
		NODE_WALLET_VERSION: joi
			.string()
			.valid(
				"simpleR1",
				"simpleR2",
				"simpleR3",
				"v2R1",
				"v2R2",
				"v3R1",
				"v3R2",
				"v4R1",
				"v4R2",
			)
			.required(),
	})
	.unknown()

const { value: envVars, error } = schema
	.prefs({ errors: { label: "key" } })
	.validate(process.env)

if (error) {
	throw new Error(`Environment validation error: ${error.message}`)
}

const provider = new HttpProvider(envVars.NODE_HTTP_PROVIDER_HOST)
const tonweb = new TonWeb(provider)

const walletContract = "wallet"
const exampleContract = "example"

const logger = createLogger(envVars.NODE_ENV)
const wallets = new Wallets(provider)
const walletManager = new WalletManager(
	wallets.all[envVars.NODE_WALLET_VERSION],
	tonweb,
	logger,
)
const exampleManager = new ExampleManager(Example as any, tonweb, logger)

const contractToManager = {
	[walletContract]: walletManager,
	[exampleContract]: exampleManager,
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
