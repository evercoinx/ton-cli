import fs from "fs/promises"
import tonMnemonic = require("tonweb-mnemonic")
import TonWeb, { contract, providers, utils } from "tonweb"
import { Logger } from "winston"

interface AddressToMnemonic {
	[key: string]: string[]
}

interface TransactionFees {
	gasFee: number
	inboundForwardFee: number
	forwardFee: number
	storageFee: number
	totalFee: number
}

/* eslint-disable no-unused-vars */
export enum SendMode {
	Ordinary = 0,
	SenderPaysForwardFees = 1,
	IgnoreErrors = 2,
	FreezeAccount = 32,
	ReturnInboundMessageValue = 64,
	ReturnAccountRemainingBalance = 128,
}
/* eslint-enable no-unused-vars */

abstract class BaseManager {
	static mnemonicFilename = "mnemonic.json"

	public constructor(
		protected Contract: typeof contract.WalletContract,
		protected tonweb: TonWeb,
		protected logger: Logger,
	) {}

	public abstract info(address: string): Promise<void>

	public async prepare(workchain = 0): Promise<void> {
		try {
			this.logger.info(`Contract preparation:`)

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
			this.logger.info(`Contract is ready to be deployed`)
			this.logger.info(`Send some TON coin to ${nonBounceableAddress}`)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async deploy(address: string): Promise<void> {
		try {
			this.logger.info(`Contract deployment:`)

			const contractAddress = new utils.Address(address)
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

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const deployResponse = await deployRequest.send()
			this.printResponse(
				deployResponse,
				`Contract was deployed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
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

	protected formatAmount(amountNano: number | string): string {
		const amount = parseFloat(utils.fromNano(amountNano))
		return `${amount.toFixed(9)} TON`
	}

	protected printAddressInfo(address: utils.Address): void {
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
	}

	protected printFees(response: providers.Fees | providers.Error): void {
		if (response["@type"] !== "query.fees") {
			throw new Error(
				`code: ${response.code}, message: ${response.message}`,
			)
		}

		const { gasFee, inboundForwardFee, forwardFee, storageFee, totalFee } =
			this.getTransactionFees(response.source_fees)
		this.logger.info(`Estimated fees:`)
		this.logger.info(`  ${this.formatAmount(gasFee)} - gas fee`)
		this.logger.info(
			`  ${this.formatAmount(inboundForwardFee)} - inbound forward fee`,
		)
		this.logger.info(`  ${this.formatAmount(forwardFee)} - forward fee`)
		this.logger.info(`  ${this.formatAmount(storageFee)} - storage fee`)
		this.logger.info(`  ${this.formatAmount(totalFee)} - total fee`)
	}

	private getTransactionFees(fees: providers.SourceFees): TransactionFees {
		const {
			gas_fee: gasFee,
			in_fwd_fee: inboundForwardFee,
			fwd_fee: forwardFee,
			storage_fee: storageFee,
		} = fees
		return {
			gasFee,
			inboundForwardFee,
			forwardFee,
			storageFee,
			totalFee: gasFee + inboundForwardFee + forwardFee + storageFee,
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
		this.logger.info(successMessage)
	}
}

export default BaseManager
