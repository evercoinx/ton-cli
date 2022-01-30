import fs from "fs/promises"
import tonMnemonic = require("tonweb-mnemonic")
import TonWeb from "tonweb"
import { Contract } from "../contract/types"
import { CommonResponse, FeeResponse, SourceFees } from "./types"

const {
	utils: { Address },
} = TonWeb

interface AddressToMnemonic {
	[key: string]: string[]
}

interface TransactionFees {
	gasFee: number
	inFwdFee: number
	fwdFee: number
	storageFee: number
	totalFee: number
}

abstract class BaseManager {
	static mnemonicFilename = "mnemonic.json"

	public constructor(
		protected tonweb: typeof TonWeb,
		protected Contract: Contract,
	) {}

	public abstract info(address: string): Promise<void>

	public async prepare(workchain = 0): Promise<void> {
		try {
			console.log(`\nContract preparation operation:`)

			const mnemonic = await tonMnemonic.generateMnemonic()
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const contract = new this.Contract(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: workchain,
			})

			const address = await contract.getAddress()
			const bounceableAddress = address.toString(true, true, true)
			await this.saveMnemonic(bounceableAddress, mnemonic)

			const deployRequest = await contract.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const nonBounceableAddress = address.toString(true, true, false)
			console.log(
				`Contract is ready to be deployed. Send some Toncoin to ${nonBounceableAddress}`,
			)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	public async deploy(address: string): Promise<void> {
		try {
			console.log(`\nExample deployment operation:`)

			const contractAddress = new Address(address)
			if (!contractAddress.isUserFriendly) {
				throw new Error(
					`Contract address should be in user friendly format`,
				)
			}
			if (!contractAddress.isBounceable) {
				throw new Error(`Contract address should be bounceable`)
			}

			const mnemonic = await this.loadMnemonic(address)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const contract = new this.Contract(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: contractAddress.wc,
			})

			const deployRequest = await contract.deploy(keyPair.secretKey)

			const feeResponse: FeeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const response: CommonResponse = await deployRequest.send()
			this.printResponse(response, `Contract was deployed successfully`)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	protected async saveMnemonic(
		address: string,
		newMnemonic: string[],
	): Promise<void> {
		const fileContents = await fs.readFile(BaseManager.mnemonicFilename)
		const mnemonic: AddressToMnemonic = JSON.parse(fileContents.toString())

		mnemonic[address] = newMnemonic
		await fs.writeFile(
			BaseManager.mnemonicFilename,
			JSON.stringify(mnemonic, null, 4),
		)
		console.log(
			`Address mnemonic was saved to ${BaseManager.mnemonicFilename}`,
		)
	}

	protected async loadMnemonic(address: string): Promise<string[]> {
		const fileContents = await fs.readFile(BaseManager.mnemonicFilename)
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

	protected formatAmount(amount: number): string {
		return `${this.tonweb.utils.fromNano(amount)} TON`
	}

	protected printAddressInfo(address: typeof Address): void {
		console.log(`- Raw address: ${address.toString(false, true, true)}`)
		console.log(
			`- Non-bounceable address (for init):     ${address.toString(
				true,
				true,
				false,
			)}`,
		)
		console.log(
			`- Bounceable address (for later access): ${address.toString(
				true,
				true,
				true,
			)}`,
		)
	}

	protected printFees(response: FeeResponse): void {
		if (response["@type"] !== "query.fees") {
			throw new Error(
				`code: ${response.code}, message: ${response.message}`,
			)
		}

		const { gasFee, inFwdFee, fwdFee, storageFee, totalFee } =
			this.getTransactionFees(response.source_fees)
		console.log(`Fees:`)
		console.log(`- Gas fee:        ${this.formatAmount(gasFee)}`)
		console.log(`- In-Forward fee: ${this.formatAmount(inFwdFee)}`)
		console.log(`- Forward fee:    ${this.formatAmount(fwdFee)}`)
		console.log(`- Storage fee:    ${this.formatAmount(storageFee)}`)
		console.log(`- Total fee:      ${this.formatAmount(totalFee)}`)
	}

	private getTransactionFees(fees: SourceFees): TransactionFees {
		const {
			gas_fee: gasFee,
			in_fwd_fee: inFwdFee,
			fwd_fee: fwdFee,
			storage_fee: storageFee,
		} = fees
		return {
			gasFee,
			inFwdFee,
			fwdFee,
			storageFee,
			totalFee: gasFee + inFwdFee + fwdFee + storageFee,
		}
	}

	protected printResponse(
		response: CommonResponse,
		successMessage: string,
	): void {
		if (response["@type"] !== "ok") {
			throw new Error(
				`code: ${response.code}, message: ${response.message}`,
			)
		}
		console.log(successMessage)
	}

	protected printError(err: unknown): void {
		console.error(`Error occurred!`)
		console.error(err)
	}
}

export default BaseManager