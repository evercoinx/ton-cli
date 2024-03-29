import BN from "bn.js"
import TonWeb, { contract, utils, Wallets } from "tonweb"
import tonMnemonic = require("tonweb-mnemonic")
import nacl from "tweetnacl"
import { Logger } from "winston"

import BaseManager, { SendMode } from "./base"

class WalletManager extends BaseManager {
	public Contract: typeof contract.WalletContract

	public constructor(
		private tonweb: TonWeb,
		protected logger: Logger,
		private version: string,
	) {
		super(logger)

		const wallets = new Wallets(tonweb.provider)
		this.Contract = wallets.all[this.version]
	}

	public async create(workchain = 0): Promise<void> {
		try {
			this.logger.info(`Create wallet:`)
			this.logger.info(`Wallet version: ${this.version}`)

			const mnemonic = await tonMnemonic.generateMnemonic()
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const contract = new this.Contract(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: workchain,
			})

			const tonContractAddress = await contract.getAddress()
			const bounceableAddress = tonContractAddress.toString(
				true,
				true,
				true,
			)

			const deployRequest = await contract.deploy(keyPair.secretKey)
			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			await this.saveMnemonic(bounceableAddress, mnemonic)

			this.logger.info(`Wallet is ready to be deployed`)
			const nonBounceableAddress = tonContractAddress.toString(
				true,
				true,
				false,
			)

			if (feeResponse["@type"] === "query.fees") {
				const fees = this.getTransactionFees(feeResponse.source_fees)
				this.logger.info(
					`Send at least ${this.formatAmount(
						fees.totalFee,
					)} to ${nonBounceableAddress}`,
				)
			}
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async deploy(
		contractAddress: string,
		secretKey = "",
	): Promise<void> {
		try {
			this.logger.info(`Deploy wallet:`)

			const tonContractAddress = new utils.Address(contractAddress)
			if (!tonContractAddress.isUserFriendly) {
				throw new Error(
					`Contract address should be in user friendly format`,
				)
			}
			if (!tonContractAddress.isBounceable) {
				throw new Error(`Contract address should be bounceable`)
			}

			let keyPair: nacl.SignKeyPair | tonMnemonic.KeyPair
			if (secretKey) {
				keyPair = nacl.sign.keyPair.fromSecretKey(
					this.hexToBytes(secretKey),
				)
			} else {
				const mnemonic = await this.loadMnemonic(contractAddress)
				keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)
			}

			const contract = new this.Contract(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: tonContractAddress.wc,
			})

			const deployRequest = await contract.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const deployResponse = await deployRequest.send()
			this.printResponse(
				deployResponse,
				`Wallet was deployed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async info(address: string): Promise<void> {
		try {
			this.logger.info(`Get wallet information:`)

			const contractAddress = new utils.Address(address)
			const contract = new this.Contract(this.tonweb.provider, {
				address: contractAddress,
			})

			const addressInfo = await this.tonweb.provider.getAddressInfo(
				address,
			)
			const seqno = await (
				contract.methods.seqno() as contract.MethodCallerRequest<number>
			).call()

			this.printAddressInfo(contractAddress, addressInfo)
			if (seqno != null) {
				this.logger.info(`Sequence number: ${seqno}`)
			}
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async transfer(
		sender: string,
		recipient: string,
		amount: number,
		memo = "",
		stateInit = false,
		workchain = 0,
		secretKey = "",
	): Promise<void> {
		try {
			this.logger.info(`Transfer TON between wallets:`)
			if (!utils.Address.isValid(sender)) {
				throw new Error(`Invalid sender address`)
			}

			const recipientAddress = new utils.Address(recipient)
			if (!recipientAddress.isUserFriendly) {
				throw new Error(
					`Recipient address should be in user friendly format`,
				)
			}

			if (stateInit && recipientAddress.isBounceable) {
				throw new Error(
					`Recipient address should be non-bounceable for state-init operation`,
				)
			}

			if (!stateInit && !recipientAddress.isBounceable) {
				throw new Error(
					`Recipient address should be bounceable for a non state-init operation`,
				)
			}

			if (amount < 0) {
				throw new Error(`Amount should be positive`)
			}

			let keyPair: nacl.SignKeyPair | tonMnemonic.KeyPair
			if (secretKey) {
				keyPair = nacl.sign.keyPair.fromSecretKey(
					this.hexToBytes(secretKey),
				)
			} else {
				const mnemonic = await this.loadMnemonic(sender)
				keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)
			}

			const contract = new this.Contract(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: workchain,
			})

			const amountNano = utils.toNano(amount)
			const senderBalance = await this.tonweb.getBalance(sender)
			if (amountNano.gt(new BN(senderBalance))) {
				throw new Error(
					`Transfer amount ${this.formatAmount(
						amountNano,
					)} exceeds balance ${this.formatAmount(senderBalance)}`,
				)
			}

			const seqno = await (
				contract.methods.seqno() as contract.MethodCallerRequest<BN>
			).call()
			if (seqno == null) {
				throw new Error(`Wallet sequence number is undefined`)
			}

			const transferRequest = contract.methods.transfer({
				secretKey: keyPair.secretKey,
				toAddress: recipientAddress,
				amount: amountNano,
				seqno,
				payload: memo,
				sendMode:
					SendMode.SenderPaysForwardFees | SendMode.IgnoreErrors,
			}) as contract.MethodSenderRequest

			const feeResponse = await transferRequest.estimateFee()
			this.printFees(feeResponse)

			const transferResponse = await transferRequest.send()
			this.printResponse(
				transferResponse,
				`${this.formatAmount(
					amountNano,
				)} were transferred successfully\n${
					memo ? `Memo: ${memo}` : `No memo`
				}`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default WalletManager
