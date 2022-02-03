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

			const balance = await this.tonweb.getBalance(address)
			const bridgeData: string[] | null = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest
			).call()

			this.printAddressInfo(contractAddress)
			this.logger.info(`Balance: ${this.formatAmount(balance)}`)
			this.logger.info(`Bridge data: ${bridgeData}`)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default BridgeManager
