import BN from "bn.js"
import TonWeb, { contract, utils } from "tonweb"
import tonMnemonic = require("tonweb-mnemonic")
import { Logger } from "winston"
import Bridge, { BridgeData } from "../contract/bridge"

import BaseManager from "./base"

class BridgeManager extends BaseManager {
	public constructor(
		private tonweb: TonWeb,
		protected logger: Logger,
		private collectorAddress: string,
		private fees: [number, number, number],
	) {
		super(logger)
	}

	public async prepare(workchain = 0): Promise<void> {
		try {
			this.logger.info(`Prepare bridge:`)

			const mnemonic = await tonMnemonic.generateMnemonic()
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const [flatReward, networkFee, feeFactor] = this.fees
			const contract = new Bridge(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: workchain,
				initialCollectorAddress: new utils.Address(
					this.collectorAddress,
				),
				initialFees: {
					flatReward: utils.toNano(flatReward),
					networkFee: utils.toNano(networkFee),
					factor: new BN(feeFactor),
				},
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

			this.logger.info(`Bridge is ready to be deployed`)
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

	public async deploy(contractAddress: string): Promise<void> {
		try {
			this.logger.info(`Deploy bridge:`)

			const tonContractAddress = new utils.Address(contractAddress)
			if (!tonContractAddress.isUserFriendly) {
				throw new Error(
					`Contract address should be in user friendly format`,
				)
			}
			if (!tonContractAddress.isBounceable) {
				throw new Error(`Contract address should be bounceable`)
			}

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const [flatReward, networkFee, feeFactor] = this.fees
			const contract = new Bridge(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: tonContractAddress.wc,
				initialCollectorAddress: new utils.Address(
					this.collectorAddress,
				),
				initialFees: {
					flatReward: utils.toNano(flatReward),
					networkFee: utils.toNano(networkFee),
					factor: new BN(feeFactor),
				},
			})

			const deployRequest = await contract.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const deployResponse = await deployRequest.send()
			this.printResponse(
				deployResponse,
				`Bridge was deployed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async info(contractAddress: string): Promise<void> {
		try {
			this.logger.info(`Get bridge info:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const contract = new Bridge(this.tonweb.provider, {
				address: contractAddress,
			})

			const addressInfo = await this.tonweb.provider.getAddressInfo(
				contractAddress,
			)
			const bridgeData = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest<BridgeData>
			).call()
			if (bridgeData == null) {
				this.printAddressInfo(tonContractAddress, addressInfo)
				return
			}

			const [
				seqno,
				publicKey,
				totalLocked,
				wc,
				addr,
				flatReward,
				networkFee,
				factor,
			] = bridgeData

			this.printAddressInfo(tonContractAddress, addressInfo)
			this.logger.info(`Sequence number: ${seqno.toNumber()}`)
			this.logger.info(`Public key: ${publicKey.toString(16)}`)
			this.logger.info(`Total locked: ${this.formatAmount(totalLocked)}`)
			this.logger.info(
				`Collector address: ${wc.toNumber()}:${addr.toString(16)}`,
			)
			this.logger.info(`Flat reward: ${this.formatAmount(flatReward)}`)
			this.logger.info(`Network fee: ${this.formatAmount(networkFee)}`)
			this.logger.info(`Factor: ${factor.toNumber()}`)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async changeCollector(
		contractAddress: string,
		newCollectorAddress: string,
	): Promise<void> {
		try {
			this.logger.info(`Change bridge collector:`)

			const tonCollectorAddress = new utils.Address(newCollectorAddress)
			if (!utils.Address.isValid(tonCollectorAddress)) {
				throw new Error(`Invalid collector address`)
			}

			const tonContractAddress = new utils.Address(contractAddress)
			const contract = new Bridge(this.tonweb.provider, {
				address: tonContractAddress,
			})

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const bridgeData = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest<BridgeData>
			).call()
			if (bridgeData == null) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = bridgeData
			const changeCollectorRequest = contract.methods.changeCollector(
				tonCollectorAddress,
				keyPair.secretKey,
				seqno,
			) as contract.MethodSenderRequest

			const feeResponse = await changeCollectorRequest.estimateFee()
			this.printFees(feeResponse)

			const changeCollectorResponse = await changeCollectorRequest.send()
			this.printResponse(
				changeCollectorResponse,
				`Bridge collector was changed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async changeFees(
		contractAddress: string,
		flatReward = 0,
		networkFee = 0,
		factor = 0,
	): Promise<void> {
		try {
			this.logger.info(`Change bridge fees:`)

			const tonContractAddress = new utils.Address(contractAddress)
			const contract = new Bridge(this.tonweb.provider, {
				address: tonContractAddress,
			})

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const bridgeData = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest<BridgeData>
			).call()
			if (bridgeData == null) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = bridgeData
			const changeCollectorRequest = contract.methods.changeFees(
				utils.toNano(flatReward),
				utils.toNano(networkFee),
				factor,
				keyPair.secretKey,
				seqno,
			) as contract.MethodSenderRequest

			const feeResponse = await changeCollectorRequest.estimateFee()
			this.printFees(feeResponse)

			const changeCollectorResponse = await changeCollectorRequest.send()
			this.printResponse(
				changeCollectorResponse,
				`Bridge fees were changed successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}

	public async withdrawReward(
		contractAddress: string,
		beneficiaryAddress: string,
	): Promise<void> {
		try {
			this.logger.info(`Withdraw bridge reward:`)

			const tonBeneficiaryAddress = new utils.Address(beneficiaryAddress)
			if (!utils.Address.isValid(tonBeneficiaryAddress)) {
				throw new Error(`Invalid beneficiary address`)
			}

			const tonContractAddress = new utils.Address(contractAddress)
			const contract = new Bridge(this.tonweb.provider, {
				address: tonContractAddress,
			})

			const mnemonic = await this.loadMnemonic(contractAddress)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const bridgeData = await (
				contract.methods.bridgeData() as contract.MethodCallerRequest<BridgeData>
			).call()
			if (bridgeData == null) {
				throw new Error(`Unable to get bridge data`)
			}

			const [seqno] = bridgeData
			const withdrawRewardRequest = contract.methods.withdrawReward(
				tonBeneficiaryAddress,
				keyPair.secretKey,
				seqno,
			) as contract.MethodSenderRequest

			const feeResponse = await withdrawRewardRequest.estimateFee()
			this.printFees(feeResponse)

			const changeCollectorResponse = await withdrawRewardRequest.send()
			this.printResponse(
				changeCollectorResponse,
				`Bridge reward was withdrawn successfully`,
			)
		} catch (err: unknown) {
			this.logger.error(err)
		}
	}
}

export default BridgeManager
