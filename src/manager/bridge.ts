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
		protected collectorAddress?: string,
	) {
		super(Contract as any, tonweb, logger, collectorAddress)
	}

	public async info(address: string): Promise<void> {
		try {
			this.logger.info(`Contract information:`)

			const contractAddress = new utils.Address(address)
			const contract = new this.Contract(this.tonweb.provider, {
				address: contractAddress,
				collectorAddress: this.collectorAddress,
			})

			const addressInfo = await this.tonweb.provider.getAddressInfo(
				address,
			)
			const rawBridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!rawBridgeData) {
				this.printAddressInfo(contractAddress, addressInfo)
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

			this.printAddressInfo(contractAddress, addressInfo)
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

	public async changeCollector(address: string): Promise<void> {
		try {
			this.logger.info(`Change collector:`)

			const collectorAddress = new utils.Address(address)
			const contract = new this.Contract(this.tonweb.provider, {
				address: collectorAddress,
				collectorAddress: this.collectorAddress,
			})

			const mnemonic = await this.loadMnemonic(address)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const rawBridgeData: BridgeData | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!rawBridgeData) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = rawBridgeData
			const changeCollectorRequest = await contract.changeCollector(
				collectorAddress,
				keyPair.secretKey,
				seqno,
			)

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
}

export default BridgeManager
