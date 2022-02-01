import TonWeb, { contract, utils } from "tonweb"
import { Logger } from "winston"

import BaseManager from "./base"

class ExampleManager extends BaseManager {
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
			const seqno: number | null = await (
				contract.methods.seqno() as contract.MethodCallerRequest
			).call()
			const publicKey: string | null = await (
				contract.methods.getPublicKey() as contract.MethodCallerRequest
			).call()

			this.printAddressInfo(contractAddress)
			this.logger.info(`Balance: ${this.formatAmount(balance)}`)
			this.logger.info(`Sequence number: ${seqno}`)
			this.logger.info(`Public key: ${publicKey}`)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default ExampleManager
