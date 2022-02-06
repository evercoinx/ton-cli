import { boc, Contract, contract, providers, utils } from "tonweb"
import { BigNumber } from "bignumber.js"

export type BridgeData = [
	BigNumber,
	BigNumber,
	BigNumber,
	BigNumber,
	BigNumber,
	BigNumber,
	BigNumber,
	BigNumber,
]

interface BridgeFeeOptions {
	flatReward: BigNumber
	networkFee: BigNumber
	factor: BigNumber
}

export interface BridgeOptions extends contract.Options {
	initialCollectorAddress?: utils.Address
	initialFees?: BridgeFeeOptions
}

/* eslint-disable no-unused-vars */
enum BridgeOperation {
	ChangeCollector = 1,
	ChangeFees = 2,
	WithdrawReward = 3,
}
/* eslint-enable no-unused-vars */

class Bridge extends Contract {
	public initialCollectorAddress?: utils.Address
	public initialFees?: BridgeFeeOptions

	public constructor(
		provider: providers.HttpProvider,
		options: BridgeOptions,
	) {
		const code = boc.Cell.oneFromBoc(
			"B5EE9C724102140100025A000114FF00F4A413F4BCF2C80B010201200203020148040503C0F28308D71820D31FDB3C5287BAF2A108F901541094F910F2A2F80004D31F21C00196313403FA40308EAC21C0029D31333535FA00FA00D30D5520338E9501C0038E8BFA403070207F218306DB3C9130E25065E2055063E204A45056103402DB3C1112130202CC06070115A1A973B67807F488AA4009110171D80E8698180B8D8492F81F07D201810EBA4E090492F81F000E98F90CA18ACF806709981699F9811418F584744C20FA009B840206D9E70AF81C1202012008090201200A0B0037D01699B80C11439BBB0B82A3791DD7970A4400A780480E881387805C0201200C0D0201200E0F004F34C1C069B40830BFFCB852483042B729BE4830BFFCB8524830443729B80830BFC870442C3CB8526000790074C3C0604C1E2EBCB8524835D26AC09C14812A8023886A80C0BC0204E800E914C06EA38448B5D2B0006696F50C340835D26AC09C37B780F90C5B04A0002F144CA848684830803CB8641400EA2049C42A4100A800682003A50C36CF151E0848FC0286684830803CB84C945128027232E7C532CFF260843011C333C0741C20C1DC60033232C0F2C072C204F2FFC4B2D84073C5B25C3EC00411840D4411D000C1F6CF2084017D78401CF6CF20111310003E814F4B70208018C8CB055006CF165004FA0214CB6A12CB1F12CB0FC901FB00002CED44D0D31FD3FFFA00FA40FA00FA00D30D552003D1580044708018C8CB055007CF1658FA0215CB6A13CB1FCB3F21C2FF92CB1F9131E2C901FB00004606C8CB1F15CBFF5003FA0201CF16502320812710BCF2D1875AFA0258FA02CB0DC9ED547DC9E1C4",
		)
		super(provider, { ...options, code })

		this.initialCollectorAddress = options.initialCollectorAddress
		this.initialFees = options.initialFees

		this.methods = {
			bridgeData: this.createCaller<BridgeData>("get_bridge_data"),
			changeCollector: (
				collectorAddress: utils.Address,
				secretKey: Uint8Array,
				seqno: number,
			) =>
				Contract.createMethod(
					this.provider,
					this.createChangeCollectorExternalMessage(
						collectorAddress,
						secretKey,
						seqno,
					),
				),
			changeFees: (
				flatReward: number,
				networkFee: number,
				factor: number,
				secretKey: Uint8Array,
				seqno: number,
			) =>
				Contract.createMethod(
					this.provider,
					this.createChangeFeesExternalMessage(
						flatReward,
						networkFee,
						factor,
						secretKey,
						seqno,
					),
				),
			withdrawReward: (
				beneficiaryAddress: utils.Address,
				secretKey: Uint8Array,
				seqno: number,
			) =>
				Contract.createMethod(
					this.provider,
					this.createWithdrawRewardExternalMessage(
						beneficiaryAddress,
						secretKey,
						seqno,
					),
				),
		}
	}

	public async deploy(
		secretKey: Uint8Array,
	): Promise<contract.MethodSenderRequest> {
		return Contract.createMethod(
			this.provider,
			this.createInitExternalMessage(secretKey),
		)
	}

	private createCaller<T>(
		methodId: providers.MethodId,
	): contract.MethodCaller<T> {
		return () => ({
			call: async () => {
				const address = await this.getAddress()
				let result: T | undefined

				try {
					result = await this.provider.call2(
						address.toString(),
						methodId,
					)
				} catch (err) {
					// ignore error
				}

				return result
			},
		})
	}

	protected createDataCell(): boc.Cell {
		const cell = new boc.Cell()
		cell.bits.writeUint(0, 32) // seqno
		if (this.options.publicKey) {
			cell.bits.writeBytes(this.options.publicKey) // public_key
		}
		cell.bits.writeGrams(0) // total_locked

		if (!this.initialCollectorAddress) {
			throw new Error(`Collector address is not initialized`)
		}
		cell.bits.writeAddress(this.initialCollectorAddress) // collector_address

		if (!this.initialFees?.flatReward) {
			throw new Error(`Flat reward is not initialized`)
		}
		cell.bits.writeGrams(this.initialFees?.flatReward) // flat_reward

		if (!this.initialFees?.networkFee) {
			throw new Error(`Network fee is not initialized`)
		}
		cell.bits.writeGrams(this.initialFees?.networkFee) // network_fee

		if (!this.initialFees?.factor) {
			throw new Error(`Fee factor is not initialized`)
		}
		cell.bits.writeUint(this.initialFees?.factor, 14) // fee_factor

		return cell
	}

	private createSigningMessage(seqno: number, op: number): boc.Cell {
		const cell = new boc.Cell()
		cell.bits.writeUint(seqno, 32)
		cell.bits.writeUint(op, 32)
		return cell
	}

	private async createInitExternalMessage(
		secretKey: Uint8Array,
	): Promise<contract.InitExternalMessage> {
		if (!this.options.publicKey) {
			const keyPair = utils.nacl.sign.keyPair.fromSecretKey(secretKey)
			this.options.publicKey = keyPair.publicKey
		}

		const signingMessage = this.createSigningMessage(0, 0)
		const signature = utils.nacl.sign.detached(
			await signingMessage.hash(),
			secretKey,
		)

		const body = new boc.Cell()
		body.bits.writeBytes(signature)
		body.writeCell(signingMessage)

		const { stateInit, address, code, data } = await this.createStateInit()
		const header = Contract.createExternalMessageHeader(address)
		const message = Contract.createCommonMsgInfo(header, stateInit, body)

		return {
			message,
			body,
			address,
			code,
			data,
		}
	}

	private async createChangeCollectorExternalMessage(
		collectorAddress: utils.Address,
		secretKey: Uint8Array,
		seqno: number,
	): Promise<contract.ExternalMessage> {
		const signingMessage = this.createSigningMessage(
			seqno,
			BridgeOperation.ChangeCollector,
		)
		signingMessage.bits.writeAddress(collectorAddress)

		return this.createExternalMessage(signingMessage, secretKey, seqno)
	}

	private async createChangeFeesExternalMessage(
		flatReward: number,
		networkFee: number,
		factor: number,
		secretKey: Uint8Array,
		seqno: number,
	): Promise<contract.ExternalMessage> {
		const signingMessage = this.createSigningMessage(
			seqno,
			BridgeOperation.ChangeFees,
		)
		signingMessage.bits.writeGrams(flatReward)
		signingMessage.bits.writeGrams(networkFee)
		signingMessage.bits.writeUint(factor, 14)

		return this.createExternalMessage(signingMessage, secretKey, seqno)
	}

	private async createWithdrawRewardExternalMessage(
		beneficiaryAddress: utils.Address,
		secretKey: Uint8Array,
		seqno: number,
	): Promise<contract.ExternalMessage> {
		const signingMessage = this.createSigningMessage(
			seqno,
			BridgeOperation.WithdrawReward,
		)
		signingMessage.bits.writeAddress(beneficiaryAddress)

		return this.createExternalMessage(signingMessage, secretKey, seqno)
	}

	private async createExternalMessage(
		signingMessage: boc.Cell,
		secretKey: Uint8Array,
		seqno: number,
		dummySignature = false,
	): Promise<contract.ExternalMessage> {
		const signature = dummySignature
			? new Uint8Array(64)
			: utils.nacl.sign.detached(await signingMessage.hash(), secretKey)

		const body = new boc.Cell()
		body.bits.writeBytes(signature)
		body.writeCell(signingMessage)

		let stateInit: boc.Cell | undefined
		let code: boc.Cell | undefined
		let data: boc.Cell | undefined

		if (seqno === 0) {
			if (!this.options.publicKey) {
				const keyPair = utils.nacl.sign.keyPair.fromSecretKey(secretKey)
				this.options.publicKey = keyPair.publicKey
			}

			const deploy = await this.createStateInit()
			stateInit = deploy.stateInit
			code = deploy.code
			data = deploy.data
		}

		const address = await this.getAddress()
		const header = Contract.createExternalMessageHeader(address)
		const message = Contract.createCommonMsgInfo(header, stateInit, body)

		return {
			message,
			body,
			address,
			code,
			data,
		}
	}
}

export default Bridge
