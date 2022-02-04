import { boc, Contract, contract, providers, utils } from "tonweb"

export interface BridgeOptions extends contract.Options {
	collectorAddress: utils.Address
}

/* eslint-disable no-unused-vars */
enum BridgeOperation {
	ChangeCollector = 1,
	ChangeFees = 2,
	GetReward = 3,
}
/* eslint-enable no-unused-vars */

class Bridge extends Contract {
	public collectorAddress: utils.Address

	public constructor(
		provider: providers.HttpProvider,
		options: BridgeOptions,
	) {
		const code = boc.Cell.oneFromBoc(
			"B5EE9C724101080100D5000114FF00F4A413F4BCF2C80B010201200203020148040502D6F28308D71820D31FDB3C5287BAF2A108F901541094F910F2A2F80004D31F21C00196313403FA40308E3721C0029D31333535FA00FA00D30D5520338E2001C0038E16FA4030708018C8CB0558CF1621FA02CB6AC98306FB009130E25065E2055063E204A45056103402DB3C06070004D0300115A1A973B67807F488AA400906002CED44D0D31FD3FFFA00FA40FA00FA00D30D552003D158004606C8CB1F15CBFF5003FA0201CF16502320812710BCF2D1875AFA0258FA02CB0DC9ED54819D02BE",
		)
		super(provider, { ...options, code })
		this.collectorAddress = options.collectorAddress

		this.methods = {
			bridgeData: this.createCaller("get_bridge_data"),
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

	private createCaller(methodId: string): contract.MethodCaller {
		return () => ({
			call: async () => {
				const address = await this.getAddress()
				let result: any = null

				try {
					result = await this.provider.call2(
						address.toString(),
						methodId,
					)
					if (result instanceof utils.BN) {
						result = result.toNumber()
					}
				} catch (e) {}

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
		cell.bits.writeAddress(this.collectorAddress) // collector_address
		cell.bits.writeGrams(5e9) // flat_reward
		cell.bits.writeGrams(1e9) // network_fee
		cell.bits.writeUint(1e4, 14) // factor
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
