import TonWeb, { contract, utils } from "tonweb"
import tonMnemonic = require("tonweb-mnemonic")
import { Logger } from "winston"
import Bridge from "../contract/bridge"

import BaseManager, { ContractType } from "./base"

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
		protected Contract: ContractType<Bridge>,
		protected tonweb: TonWeb,
		protected logger: Logger,
		protected collectorAddress: utils.Address,
	) {
		super(Contract as any, tonweb, logger, collectorAddress)
	}

	public async info(contractAddress: string): Promise<void> {
		try {
			this.logger.info(`Contract information:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const contract = new this.Contract(this.tonweb.provider, {
				address: contractAddress,
				collectorAddress: new utils.Address(this.collectorAddress),
			})

			const addressInfo = await this.tonweb.provider.getAddressInfo(
				contractAddress,
			)
			const rawBridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!rawBridgeData) {
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
			] = rawBridgeData

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
			this.logger.info(`Change collector:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const tonCollectorAddress = new utils.Address(collectorAddress)
			const contract = new this.Contract(this.tonweb.provider, {
				address: tonContractAddress,
				collectorAddress: tonCollectorAddress,
			})

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const rawBridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!rawBridgeData) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = rawBridgeData
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
				`Collector changed successfully`,
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
			this.logger.info(`Change fees:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const tonCollectorAddress = new utils.Address(this.collectorAddress)
			const contract = new this.Contract(this.tonweb.provider, {
				address: tonContractAddress,
				collectorAddress: tonCollectorAddress,
			})

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const rawBridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!rawBridgeData) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = rawBridgeData
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
				`Fees changed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default BridgeManager
