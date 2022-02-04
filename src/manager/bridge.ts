import TonWeb, { contract, utils } from "tonweb"
import tonMnemonic = require("tonweb-mnemonic")
import { Logger } from "winston"
import Bridge from "../contract/bridge"

import BaseManager from "./base"

export type BridgeData = [
	typeof utils.BN,
	typeof utils.BN,
	typeof utils.BN,
	typeof utils.BN,
	typeof utils.BN,
	typeof utils.BN,
	typeof utils.BN,
	typeof utils.BN,
]

class BridgeManager extends BaseManager {
	public constructor(
		protected tonweb: TonWeb,
		protected logger: Logger,
		protected collectorAddress: utils.Address,
	) {
		super(logger)
	}

	public async prepare(workchain = 0): Promise<void> {
		try {
			this.logger.info(`Prepare bridge:`)

			const mnemonic = await tonMnemonic.generateMnemonic()
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const contract = new Bridge(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: workchain,
				collectorAddress: this.collectorAddress,
			})

			const tonContractAddress = await contract.getAddress()
			const bounceableAddress = tonContractAddress.toString(
				true,
				true,
				true,
			)
			await this.saveMnemonic(bounceableAddress, mnemonic)

			const deployRequest = await contract.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const nonBounceableAddress = tonContractAddress.toString(
				true,
				true,
				false,
			)
			this.logger.info(`Bridge is ready to be deployed`)

			if (feeResponse["@type"] === "query.fees") {
				const fees = this.getTransactionFees(feeResponse.source_fees)
				this.logger.info(
					`Send at least ${fees.totalFee} TON to ${nonBounceableAddress}`,
				)
			}
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async deploy(contractAddress: string): Promise<void> {
		try {
			this.logger.info(`Deploy bridge:`)

			const tonContractAddress = new utils.Address(contractAddress)
			if (!tonContractAddress.isUserFriendly) {
				throw new Error(
					`Contract address should be in user friendly format`,
				)
			}
			if (!tonContractAddress.isBounceable) {
				throw new Error(`Contract address should be bounceable`)
			}

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const contract = new Bridge(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: tonContractAddress.wc,
				collectorAddress: this.collectorAddress,
			})

			const deployRequest = await contract.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const deployResponse = await deployRequest.send()
			this.printResponse(
				deployResponse,
				`Contract was deployed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async info(contractAddress: string): Promise<void> {
		try {
			this.logger.info(`Get bridge info:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const contract = new Bridge(this.tonweb.provider, {
				address: contractAddress,
				collectorAddress: new utils.Address(this.collectorAddress),
			})

			const addressInfo = await this.tonweb.provider.getAddressInfo(
				contractAddress,
			)
			const bridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!bridgeData) {
				this.printAddressInfo(tonContractAddress, addressInfo)
				return
			}

			const [
				seqno,
				publicKey,
				totalLocked,
				wc,
				addr,
				flatReward,
				networkFee,
				factor,
			] = bridgeData

			this.printAddressInfo(tonContractAddress, addressInfo)
			this.logger.info(`Sequence number: ${seqno}`)
			this.logger.info(`Public key: ${publicKey}`)
			this.logger.info(`Total locked: ${totalLocked}`)
			this.logger.info(`Collector address: ${wc}:${addr}`)
			this.logger.info(`Flat reward: ${flatReward}`)
			this.logger.info(`Network fee: ${networkFee}`)
			this.logger.info(`Factor: ${factor}`)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async changeCollector(
		contractAddress: string,
		collectorAddress: string,
	): Promise<void> {
		try {
			this.logger.info(`Change bridge collector:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const tonCollectorAddress = new utils.Address(collectorAddress)
			const contract = new Bridge(this.tonweb.provider, {
				address: tonContractAddress,
				collectorAddress: tonCollectorAddress,
			})

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const bridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!bridgeData) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = bridgeData
			const changeCollectorRequest = contract.methods.changeCollector(
				tonCollectorAddress,
				keyPair.secretKey,
				seqno,
			) as contract.MethodSenderRequest

			const feeResponse = await changeCollectorRequest.estimateFee()
			this.printFees(feeResponse)

			const changeCollectorResponse = await changeCollectorRequest.send()
			this.printResponse(
				changeCollectorResponse,
				`Bridge collector changed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async changeFees(
		contractAddress: string,
		flatReward = 0,
		networkFee = 0,
		factor = 0,
	): Promise<void> {
		try {
			this.logger.info(`Change bridge fees:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const tonCollectorAddress = new utils.Address(this.collectorAddress)
			const contract = new Bridge(this.tonweb.provider, {
				address: tonContractAddress,
				collectorAddress: tonCollectorAddress,
			})

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const bridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!bridgeData) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = bridgeData
			const changeCollectorRequest = contract.methods.changeFees(
				utils.toNano(flatReward),
				utils.toNano(networkFee),
				factor,
				keyPair.secretKey,
				seqno,
			) as contract.MethodSenderRequest

			const feeResponse = await changeCollectorRequest.estimateFee()
			this.printFees(feeResponse)

			const changeCollectorResponse = await changeCollectorRequest.send()
			this.printResponse(
				changeCollectorResponse,
				`Bridge fees changed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default BridgeManager
