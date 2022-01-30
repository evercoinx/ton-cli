import tonMnemonic = require("tonweb-mnemonic")
import TonWeb from "tonweb"

import ContractManager, { CommonResponse, FeeResponse } from "./contract"

const { BN, Address } = TonWeb.utils

class WalletManager extends ContractManager {
	static mnemonicFilename = "mnemonic.json"

	public constructor(protected tonweb: typeof TonWeb) {
		super(tonweb)
	}

	public async prepare(workchain: number): Promise<void> {
		try {
			console.log(`\nWallet preparation operation:`)

			const mnemonic = await tonMnemonic.generateMnemonic()
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const wallet = this.tonweb.wallet.create({
				publicKey: keyPair.publicKey,
				wc: workchain,
			})

			const address = await wallet.getAddress()
			const bounceableAddress = address.toString(true, true, true)
			await this.saveMnemonic(bounceableAddress, mnemonic)

			const deployRequest = await wallet.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const nonBounceableAddress = address.toString(true, true, false)
			console.log(
				`Wallet is ready to be deployed at ${nonBounceableAddress}`,
			)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	public async deploy(address: string): Promise<void> {
		try {
			console.log(`\nWallet deployment operation:`)

			const walletAddress = new Address(address)
			if (!walletAddress.isUserFriendly) {
				throw new Error(
					`Wallet address should be in user friendly format`,
				)
			}
			if (!walletAddress.isBounceable) {
				throw new Error(`Wallet address should be bounceable`)
			}

			const mnemonic = await this.loadMnemonic(address)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const wallet = this.tonweb.wallet.create({
				publicKey: keyPair.publicKey,
				wc: walletAddress.wc,
			})

			const deployRequest = await wallet.deploy(keyPair.secretKey)

			const feeResponse: FeeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const response: CommonResponse = await deployRequest.send()
			if (response["@type"] !== "ok") {
				throw new Error(
					`Code: ${response.code}, message: ${response.message}`,
				)
			}
			console.log(`Wallet was deployed successfully`)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	public async info(address: string): Promise<void> {
		try {
			console.log(`\nWallet information:`)

			const walletAddress = new Address(address)
			const wallet = this.tonweb.wallet.create({
				address: walletAddress,
			})

			const seqno: number | null = await wallet.methods.seqno().call()
			const balance = await this.tonweb.getBalance(address)

			this.printAddressInfo(walletAddress)
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
		stateinit: boolean,
		memo: string,
	): Promise<void> {
		try {
			console.log(`\nTransfer operation between wallets:`)

			const recipientAddress = new Address(recipient)
			if (!recipientAddress.isUserFriendly) {
				throw new Error(
					`Recipient's wallet address should be in user friendly format`,
				)
			}

			if (stateinit && recipientAddress.isBounceable) {
				throw new Error(
					`Recipient's wallet address should be non-bounceable for state init operation`,
				)
			}

			if (!stateinit && !recipientAddress.isBounceable) {
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
			if (response["@type"] !== "ok") {
				throw new Error(
					`Code: ${response.code}, message: ${response.message}`,
				)
			}
			console.log(
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
