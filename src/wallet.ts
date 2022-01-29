import fs from "fs/promises"

import tonMnemonic from "tonweb-mnemonic"
import TonWeb from "tonweb"

const { BN, Address } = TonWeb.utils

interface AddressToMnemonic {
	[key: string]: string[]
}

interface BaseResponse {
	"@type": string
	code?: string
	message?: string
}

interface Fees {
	gas_fee: number
	in_fwd_fee: number
	fwd_fee: number
	storage_fee: number
}

interface FeeResponse extends BaseResponse {
	source_fees: Fees
	target_fees: Fees
}

class Wallet {
	static mnemonicFilename = "mnemonic.json"

	public constructor(private tonweb: typeof TonWeb) {}

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

			const response: BaseResponse = await deployRequest.send()
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

			console.log(
				`- New wallet address: ${walletAddress.toString(
					false,
					true,
					true,
				)}`,
			)
			console.log(
				`- Non-bounceable address (for init):     ${walletAddress.toString(
					true,
					true,
					false,
				)}`,
			)
			console.log(
				`- Bounceable address (for later access): ${walletAddress.toString(
					true,
					true,
					true,
				)}`,
			)
			console.log(`- Balance: ${this.formatAmount(balance)}`)
			console.log(`- Sequence number: ${seqno || "0"}`)
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
				seqno,
				payload: memo,
				sendMode: 3,
			})

			const feeResponse: FeeResponse = await transferRequest.estimateFee()
			this.printFees(feeResponse)

			const response: BaseResponse = await transferRequest.send()
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

	private async saveMnemonic(
		address: string,
		newMnemonic: string[],
	): Promise<void> {
		const fileContents = await fs.readFile(Wallet.mnemonicFilename)
		const mnemonic: AddressToMnemonic = JSON.parse(fileContents.toString())

		mnemonic[address] = newMnemonic
		await fs.writeFile(
			Wallet.mnemonicFilename,
			JSON.stringify(mnemonic, null, 4),
		)
		console.log(
			`Wallet mnemonic was saved to ${Wallet.mnemonicFilename} file`,
		)
	}

	private async loadMnemonic(address: string): Promise<string[]> {
		const fileContents = await fs.readFile(Wallet.mnemonicFilename)
		const mnemonic: AddressToMnemonic = JSON.parse(fileContents.toString())

		const addressMnemonic = mnemonic[address]
		if (!addressMnemonic) {
			throw new Error(`Address mnemonic is not found`)
		}

		const valid = await tonMnemonic.validateMnemonic(addressMnemonic)
		if (!valid) {
			throw new Error(`Address mnemonic is invalid`)
		}

		return addressMnemonic
	}

	private formatAmount(amount: number): string {
		return `${this.tonweb.utils.fromNano(amount)} TON`
	}

	private printFees(response: FeeResponse): void {
		if (response["@type"] !== "query.fees") {
			throw new Error(
				`Code: ${response.code}, message: ${response.message}`,
			)
		}

		const fees = response.source_fees
		console.log(`Fees:`)
		console.log(`- Gas fee:        ${this.formatAmount(fees.gas_fee)}`)
		console.log(`- In-Forward fee: ${this.formatAmount(fees.in_fwd_fee)}`)
		console.log(`- Forward fee:    ${this.formatAmount(fees.fwd_fee)}`)
		console.log(`- Storage fee:    ${this.formatAmount(fees.storage_fee)}`)
	}

	printError(err: unknown) {
		const message = err instanceof Error ? err.message : err
		console.error(`Error! ${message}`)
	}
}

export default Wallet
