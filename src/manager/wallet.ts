import tonMnemonic = require("tonweb-mnemonic")
import TonWeb from "tonweb"

import { CommonResponse, FeeResponse } from "./types"
import { Contract } from "../contract/types"
import BaseManager from "./base"

const {
	utils: { BN, Address },
} = TonWeb

class WalletManager extends BaseManager {
	static mnemonicFilename = "mnemonic.json"

	public constructor(protected tonweb: typeof TonWeb, contract: Contract) {
		super(tonweb, contract)
	}

	public async info(address: string): Promise<void> {
		try {
			console.log(`\nContract information:`)

			const contractAddress = new Address(address)
			const contract = new this.Contract(this.tonweb.provider, {
				address: contractAddress,
			})

			const seqno: number | null = await contract.methods.seqno().call()
			const balance = await this.tonweb.getBalance(address)

			this.printAddressInfo(contractAddress)
			console.log(`- Balance: ${this.formatAmount(balance)}`)
			console.log(`- Sequence number: ${seqno}`)
		} catch (err: unknown) {
			this.printError(err)
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
			console.log(`\nWallet transfer operation:`)

			const recipientAddress = new Address(recipient)
			if (!recipientAddress.isUserFriendly) {
				throw new Error(
					`Recipient's wallet address should be in user friendly format`,
				)
			}

			if (stateInit && recipientAddress.isBounceable) {
				throw new Error(
					`Recipient's wallet address should be non-bounceable for state init operation`,
				)
			}

			if (!stateInit && !recipientAddress.isBounceable) {
				throw new Error(
					`Recipient's wallet address should be bounceable for any not state init operation`,
				)
			}

			if (amount < 0) {
				throw new Error(`Amount should be positive`)
			}

			const mnemonic = await this.loadMnemonic(sender)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const wallet = this.tonweb.wallet.create({
				publicKey: keyPair.publicKey,
			})

			const amountNano = this.tonweb.utils.toNano(amount)
			const senderBalance = await this.tonweb.getBalance(sender)
			if (amountNano.gt(new BN(senderBalance))) {
				throw new Error(
					`Transfer amount ${this.formatAmount(
						amountNano,
					)} exceeds balance ${this.formatAmount(senderBalance)}`,
				)
			}

			const seqno: number | null = await wallet.methods.seqno().call()
			if (seqno == null) {
				throw new Error(`Wallet sequence number is undefined`)
			}

			const transferRequest = wallet.methods.transfer({
				secretKey: keyPair.secretKey,
				toAddress: recipientAddress,
				amount: amountNano,
				seqno: seqno || 0,
				payload: memo,
				sendMode: 3,
			})

			const feeResponse: FeeResponse = await transferRequest.estimateFee()
			this.printFees(feeResponse)

			const response: CommonResponse = await transferRequest.send()
			this.printResponse(
				response,
				`${this.formatAmount(
					amountNano,
				)} were transferred successfully`,
			)
		} catch (err: unknown) {
			this.printError(err)
		}
	}
}

export default WalletManager
