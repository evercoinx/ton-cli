import TonWeb, { contract, utils } from "tonweb"
import { Logger } from "winston"

import BaseManager from "./base"

class BridgeManager extends BaseManager {
	public constructor(
		protected Contract: typeof contract.WalletContract,
		protected tonweb: TonWeb,
		protected logger: Logger,
	) {
		super(Contract, tonweb, logger)
	}

	public async info(address: string): Promise<void> {
		try {
			this.logger.info(`Contract information:`)

			const contractAddress = new utils.Address(address)
			const contract = new this.Contract(this.tonweb.provider, {
				address: contractAddress,
			})

			const addressInfo = await this.tonweb.provider.getAddressInfo(
				address,
			)
			const rawBridgeData: [number, string, number] | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()
			if (!rawBridgeData) {
				this.printAddressInfo(contractAddress, addressInfo)
				return
			}

			const [seqno, publicKey, totalLocked] = rawBridgeData
			this.printAddressInfo(contractAddress, addressInfo)
			this.logger.info(`Sequence number: ${seqno}`)
			this.logger.info(`Public key: ${publicKey}`)
			this.logger.info(`Total locked: ${totalLocked}`)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default BridgeManager
