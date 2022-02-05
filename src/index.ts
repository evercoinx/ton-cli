import "dotenv/config"
import joi from "joi"
import TonWeb, { HttpProvider } from "tonweb"
import yargs, { Argv } from "yargs"
import { hideBin } from "yargs/helpers"

import createLogger from "./logger"
import WalletManager from "./manager/wallet"
import BridgeManager from "./manager/bridge"

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
		NODE_COLLECTOR_ADDRESS: joi.string().required(),
		NODE_FLAT_REWARD: joi.number().precision(9).max(1000).required(),
		NODE_NETWORK_FEE: joi.number().precision(9).max(1000).required(),
		NODE_FEE_FACTOR: joi.number().precision(0).max(10000).required(),
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
const bridgeContract = "bridge"

const logger = createLogger(envVars.NODE_ENV)
const walletManager = new WalletManager(
	tonweb,
	logger,
	envVars.NODE_WALLET_VERSION,
)
const bridgeManager = new BridgeManager(
	tonweb,
	logger,
	envVars.NODE_COLLECTOR_ADDRESS,
	[
		envVars.NODE_FLAT_REWARD,
		envVars.NODE_NETWORK_FEE,
		envVars.NODE_FEE_FACTOR,
	],
)

const contractToManager = {
	[walletContract]: walletManager,
	[bridgeContract]: bridgeManager,
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
						describe: "Sender wallet address",
					})
					.positional("recipient", {
						describe: "Recipient wallet address",
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
				await contractToManager[walletContract].transfer(
					sender,
					recipient,
					amount,
					stateinit,
					memo,
				)
			},
		})

		.command(createPrepareCommand(bridgeContract))
		.command(createDeployCommand(bridgeContract))
		.command(createInfoCommand(bridgeContract))
		.command({
			command: "changecollector <contract> <collector>",
			aliases: ["bcc"],
			describe: "Change collector",
			builder: (yargs: Argv) =>
				yargs
					.positional("contract", {
						describe: "Contract address",
					})
					.positional("collector", {
						describe: "Collector address",
					}),
			handler: async (argv: any) => {
				const { contract, collector } = argv
				await contractToManager[bridgeContract].changeCollector(
					contract,
					collector,
				)
			},
		})
		.command({
			command: "changefees <contract> [flatreward] [networkfee] [factor]",
			aliases: ["bcf"],
			describe: "Change fees",
			builder: (yargs: Argv) =>
				yargs
					.positional("contract", {
						describe: "Contract address",
					})
					.positional("flatreward", {
						describe: "Flat reward (in TON). Defaults to 0",
						default: 0,
					})
					.coerce("flatreward", (opt: string) => parseFloat(opt))
					.positional("networkfee", {
						describe: "Network fee (in TON). Defaults to 0",
						default: 0,
					})
					.coerce("networkfee", (opt: string) => parseFloat(opt))
					.positional("factor", {
						describe: "Factor. Defaults to 100",
						default: 100,
					})
					.coerce("factor", (opt: string) => parseInt(opt)),
			handler: async (argv: any) => {
				const { contract, flatreward, networkfee, factor } = argv
				await contractToManager[bridgeContract].changeFees(
					contract,
					flatreward,
					networkfee,
					factor,
				)
			},
		})
		.command({
			command: "withdrawreward <contract> <beneficiary>",
			aliases: ["bwr"],
			describe: "Withdraw reward",
			builder: (yargs: Argv) =>
				yargs
					.positional("contract", {
						describe: "Contract address",
					})
					.positional("beneficiary", {
						describe: "Beneficiary address",
					}),
			handler: async (argv: any) => {
				const { contract, beneficiary } = argv
				await contractToManager[bridgeContract].withdrawReward(
					contract,
					beneficiary,
				)
			},
		})

		.strictCommands()
		.demandCommand(1)
		.help().argv
})()
