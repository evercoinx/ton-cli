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
		HTTP_PROVIDER_HOST: joi.string().uri().required(),
		HTTP_PROVIDER_API_KEY: joi.string().alphanum().length(64).required(),
		WALLET_VERSION: joi
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
		COLLECTOR_ADDRESS: joi.string().required(),
		FLAT_REWARD: joi.number().precision(9).max(1000).required(),
		NETWORK_FEE: joi.number().precision(9).max(1000).required(),
		FEE_FACTOR: joi.number().precision(0).max(10000).required(),
	})
	.unknown()

const { value: envVars, error } = schema
	.prefs({ errors: { label: "key" } })
	.validate(process.env)

if (error) {
	throw new Error(`Environment validation error: ${error.message}`)
}

const WALLET_CONTRACT = "wallet"
const BRDIGE_CONTRACT = "bridge"

const httpProvider = new HttpProvider(envVars.HTTP_PROVIDER_HOST, {
	apiKey: envVars.HTTP_PROVIDER_API_KEY,
})
const tonweb = new TonWeb(httpProvider)

const logger = createLogger(envVars.NODE_ENV)
const walletManager = new WalletManager(tonweb, logger, envVars.WALLET_VERSION)
const bridgeManager = new BridgeManager(
	tonweb,
	logger,
	envVars.COLLECTOR_ADDRESS,
	[envVars.FLAT_REWARD, envVars.NETWORK_FEE, envVars.FEE_FACTOR],
)

const contractToManager = {
	[WALLET_CONTRACT]: walletManager,
	[BRDIGE_CONTRACT]: bridgeManager,
}

const getCreateCommand = (contract: string) => ({
	command: `${contract}create [workchain]`,
	aliases: [`${contract[0]}c`],
	describe: `Create ${contract}`,
	builder: (yargs: Argv) =>
		yargs
			.positional("workchain", {
				describe: "Workchain id. Defaults to 0",
				default: 0,
			})
			.coerce("workchain", (opt: string) => parseInt(opt)),
	handler: async (argv: any) => {
		const { workchain } = argv
		await contractToManager[contract].create(workchain)
	},
})

const getDeployCommand = (contract: string) => ({
	command: `${contract}deploy <address> [secretKey]`,
	aliases: [`${contract[0]}d`],
	describe: `Deploy ${contract}`,
	builder: (yargs: Argv) =>
		yargs
			.positional("address", {
				describe: "Contract address",
			})
			.positional("secretKey", {
				describe: "Secret key",
				default: "",
			}),
	handler: async (argv: any) => {
		const { address, secretKey } = argv
		await contractToManager[contract].deploy(address, secretKey)
	},
})

const getInfoCommand = (contract: string) => ({
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

		.command(getCreateCommand(WALLET_CONTRACT))
		.command(getDeployCommand(WALLET_CONTRACT))
		.command(getInfoCommand(WALLET_CONTRACT))
		.command({
			command:
				"wallettransfer <sender> <recipient> <amount> [stateInit] [memo] [workchain] [secretKey]",
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
							"Check if address should be non-bounceable for state-init operation",
						default: false,
					})
					.coerce("stateInit", (opt: string) => !!parseInt(opt))
					.positional("memo", {
						describe: "Transaction memo",
						default: "",
					})
					.positional("workchain", {
						describe: "Workchain id. Defaults to 0",
						default: 0,
					})
					.coerce("workchain", (opt: string) => parseInt(opt))
					.positional("secretKey", {
						describe: "Secret key",
						default: "",
					}),
			handler: async (argv: any) => {
				const {
					sender,
					recipient,
					amount,
					stateInit,
					memo,
					workchain,
					secretKey,
				} = argv
				await contractToManager[WALLET_CONTRACT].transfer(
					sender,
					recipient,
					amount,
					stateInit,
					memo,
					workchain,
					secretKey,
				)
			},
		})

		.command(getCreateCommand(BRDIGE_CONTRACT))
		.command(getDeployCommand(BRDIGE_CONTRACT))
		.command(getInfoCommand(BRDIGE_CONTRACT))
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
				await contractToManager[BRDIGE_CONTRACT].changeCollector(
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
				await contractToManager[BRDIGE_CONTRACT].changeFees(
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
				await contractToManager[BRDIGE_CONTRACT].withdrawReward(
					contract,
					beneficiary,
				)
			},
		})
		.command({
			command: "logevents <contract>",
			aliases: ["ble"],
			describe: "Get log events",
			builder: (yargs: Argv) =>
				yargs.positional("contract", {
					describe: "Contract address",
				}),
			handler: async (argv: any) => {
				const { contract } = argv
				await contractToManager[BRDIGE_CONTRACT].logEvents(contract)
			},
		})

		.strictCommands()
		.demandCommand(1)
		.help().argv
})()
