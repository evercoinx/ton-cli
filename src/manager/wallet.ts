import TonWeb, { contract, utils } from "tonweb"
import tonMnemonic = require("tonweb-mnemonic")
import { Logger } from "winston"

import BaseManager from "./base"

class WalletManager extends BaseManager {
	static mnemonicFilename = "mnemonic.json"

	public constructor(
		Contract: typeof contract.WalletContract,
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

			const seqno: number | null = await (
				contract.methods.seqno() as contract.MethodCallerRequest
			).call()
			const balance = await this.tonweb.getBalance(address)

			this.printAddressInfo(contractAddress)
			this.logger.info(`Balance: ${this.formatAmount(balance)}`)
			this.logger.info(`Sequence number: ${seqno}`)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async transfer(
		sender: string,
		recipient: string,
		amount: number,
		stateInit: boolean,
		memo: string,
	): Promise<void> {
		try {
			this.logger.info(`\nWallet transfer:`)
			if (!utils.Address.isValid(sender)) {
				throw new Error(`Invalid sender's address`)
			}

			const recipientAddress = new utils.Address(recipient)
			if (!recipientAddress.isUserFriendly) {
				throw new Error(
					`Recipient's address should be in user friendly format`,
				)
			}

			if (stateInit && recipientAddress.isBounceable) {
				throw new Error(
					`Recipient's address should be non-bounceable for state init operation`,
				)
			}

			if (!stateInit && !recipientAddress.isBounceable) {
				throw new Error(
					`Recipient's address should be bounceable for any not state init operation`,
				)
			}

			if (amount < 0) {
				throw new Error(`Amount should be positive`)
			}

			const mnemonic = await this.loadMnemonic(sender)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const contract = new this.Contract(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
			})

			const amountNano = utils.toNano(amount)
			const senderBalance = await this.tonweb.getBalance(sender)
			if (amountNano.gt(new utils.BN(senderBalance))) {
				throw new Error(
					`Transfer amount ${this.formatAmount(
						amountNano,
					)} exceeds balance ${this.formatAmount(senderBalance)}`,
				)
			}

			const seqno: number | null = await (
				contract.methods.seqno() as contract.MethodCallerRequest
			).call()
			if (seqno == null) {
				throw new Error(
					`Wallet sequence number is undefined. Probably wallet is uninitialized`,
				)
			}

			const transferRequest = contract.methods.transfer({
				secretKey: keyPair.secretKey,
				toAddress: recipientAddress,
				amount: amountNano,
				seqno,
				payload: memo,
				sendMode: 3,
			}) as contract.MethodSenderRequest

			const feeResponse = await transferRequest.estimateFee()
			this.printFees(feeResponse)

			const transferResponse = await transferRequest.send()
			this.printResponse(
				transferResponse,
				`${this.formatAmount(
					amountNano,
				)} were transferred successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default WalletManager
