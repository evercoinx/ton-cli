import TonWeb, { contract, utils } from "tonweb"

import BaseManager from "./base"

class ExampleManager extends BaseManager {
	public constructor(
		protected tonweb: TonWeb,
		protected Contract: typeof contract.WalletContract,
	) {
		super(tonweb, Contract)
	}

	public async info(address: string): Promise<void> {
		try {
			console.log(`\nContract information:`)

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
			console.log(`- Balance: ${this.formatAmount(balance)}`)
			console.log(`- Sequence number: ${seqno}`)
			console.log(`- Public key: ${publicKey}`)
		} catch (err: unknown) {
			this.printError(err)
		}
	}
}

export default ExampleManager
