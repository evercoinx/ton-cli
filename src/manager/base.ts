import fs from "fs/promises"
import { BigNumber } from "bignumber.js"
import tonMnemonic = require("tonweb-mnemonic")
import { providers, utils } from "tonweb"
import { Logger } from "winston"

interface AddressToMnemonic {
	[key: string]: string[]
}

interface TransactionFees {
	gasFee: number
	inboundForwardFee: number
	outboundForwardFee: number
	storageFee: number
	totalFee: number
}

/* eslint-disable no-unused-vars */
export enum SendMode {
	NoAction = 0,
	SenderPaysForwardFees = 1,
	IgnoreErrors = 2,
	FreezeAccount = 32,
	ReturnInboundMessageValue = 64,
	ReturnAccountRemainingBalance = 128,
}
/* eslint-enable no-unused-vars */

abstract class BaseManager {
	static mnemonicFilename = "mnemonic.json"

	public constructor(protected logger: Logger) {}

	public abstract prepare(workchain: number): Promise<void>

	public abstract deploy(contractAddress: string): Promise<void>

	public abstract info(contractAddress: string): Promise<void>

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
		this.logger.info(
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

	protected formatAmount(amountNano: string | number | BigNumber): string {
		if (amountNano instanceof BigNumber) {
			return `${utils.fromNano(amountNano)} TON`
		}
		const amount = parseFloat(utils.fromNano(amountNano))
		return `${amount.toFixed(9)} TON`
	}

	protected printAddressInfo(
		address: utils.Address,
		response: providers.AddressInfo | providers.Error,
	): void {
		if (response["@type"] === "error") {
			throw new Error(
				`code: ${response.code}, message: ${response.message}`,
			)
		}

		this.logger.info(`Raw address: ${address.toString(false, true, true)}`)
		this.logger.info(
			`Non-bounceable address (for init):     ${address.toString(
				true,
				true,
				false,
			)}`,
		)
		this.logger.info(
			`Bounceable address (for later access): ${address.toString(
				true,
				true,
				true,
			)}`,
		)
		this.logger.info(`State: ${response.state}`)
		this.logger.info(`Balance: ${this.formatAmount(response.balance)}`)
	}

	protected printFees(response: providers.Fees | providers.Error): void {
		if (response["@type"] === "error") {
			throw new Error(
				`code: ${response.code}, message: ${response.message}`,
			)
		}

		const {
			gasFee,
			inboundForwardFee,
			outboundForwardFee,
			storageFee,
			totalFee,
		} = this.getTransactionFees(response.source_fees)
		this.logger.info(`Estimated fees:`)
		this.logger.info(`  ${this.formatAmount(gasFee)} - gas fee`)
		this.logger.info(
			`  ${this.formatAmount(inboundForwardFee)} - inbound forward fee`,
		)
		this.logger.info(
			`  ${this.formatAmount(outboundForwardFee)} - outbound forward fee`,
		)
		this.logger.info(`  ${this.formatAmount(storageFee)} - storage fee`)
		this.logger.info(`  ${this.formatAmount(totalFee)} - total fee`)
	}

	protected getTransactionFees(fees: providers.SourceFees): TransactionFees {
		const {
			gas_fee: gasFee,
			in_fwd_fee: inboundForwardFee,
			fwd_fee: outboundForwardFee,
			storage_fee: storageFee,
		} = fees
		return {
			gasFee,
			inboundForwardFee,
			outboundForwardFee,
			storageFee,
			totalFee:
				gasFee + inboundForwardFee + outboundForwardFee + storageFee,
		}
	}

	protected printResponse(
		response: providers.Send | providers.Error,
		successMessage: string,
	): void {
		if (response["@type"] !== "ok") {
			throw new Error(
				`code: ${response.code}, message: ${response.message}`,
			)
		}

		successMessage
			.split("\n")
			.forEach((message: string) => this.logger.info(message))
	}
}

export default BaseManager
