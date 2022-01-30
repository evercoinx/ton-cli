import fs from "fs/promises"
import tonMnemonic = require("tonweb-mnemonic")
import TonWeb from "tonweb"

const { Address } = TonWeb.utils

interface AddressToMnemonic {
	[key: string]: string[]
}

interface CommonSuccessResponse {
	"@type": "ok"
	"@extra": string
}

interface ErrorResponse {
	"@type": "error"
	code: string
	message: string
	"@extra": string
}

export type CommonResponse = CommonSuccessResponse | ErrorResponse

interface FeeSuccessResponse {
	"@type": "query.fees"
	source_fees: {
		"@type": "fees"
		gas_fee: number
		in_fwd_fee: number
		fwd_fee: number
		storage_fee: number
	}
	destination_fees: unknown[]
	"@extra": string
}

export type FeeResponse = FeeSuccessResponse | ErrorResponse

abstract class ContractManager {
	static mnemonicFilename = "mnemonic.json"

	public constructor(protected tonweb: typeof TonWeb) {}

	public abstract prepare(workchain: number): Promise<void>

	public abstract deploy(address: string): Promise<void>

	public abstract info(address: string): Promise<void>

	protected async saveMnemonic(
		address: string,
		newMnemonic: string[],
	): Promise<void> {
		const fileContents = await fs.readFile(ContractManager.mnemonicFilename)
		const mnemonic: AddressToMnemonic = JSON.parse(fileContents.toString())

		mnemonic[address] = newMnemonic
		await fs.writeFile(
			ContractManager.mnemonicFilename,
			JSON.stringify(mnemonic, null, 4),
		)
		console.log(
			`Address mnemonic was saved to ${ContractManager.mnemonicFilename}`,
		)
	}

	protected async loadMnemonic(address: string): Promise<string[]> {
		const fileContents = await fs.readFile(ContractManager.mnemonicFilename)
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

		const fees = response.source_fees
		console.log(`Fees:`)
		console.log(`- Gas fee:        ${this.formatAmount(fees.gas_fee)}`)
		console.log(`- In-Forward fee: ${this.formatAmount(fees.in_fwd_fee)}`)
		console.log(`- Forward fee:    ${this.formatAmount(fees.fwd_fee)}`)
		console.log(`- Storage fee:    ${this.formatAmount(fees.storage_fee)}`)
	}

	protected printError(err: unknown): void {
		console.error(`Error occurred!`)
		console.error(err)
	}
}

export default ContractManager
