import { boc, Contract, contract, providers, utils } from "tonweb"

class Bridge extends Contract {
	public constructor(
		provider: providers.HttpProvider,
		options: contract.Options,
	) {
		const code = boc.Cell.oneFromBoc(
			"B5EE9C72410108010063000114FF00F4A413F4BCF2C80B01020120020302014804050244F28308D71820D31FDB3C5243BAF2A104F901541054F910F2A2F800D31F5BA402DB3C06070004D0300109A1A973B679060014ED44D0D31FD3FFFA00D1001802C8CB1FCBFF01FA02C9ED5453758FFE",
		)
		super(provider, { ...options, code })

		this.methods = {
			bridgeData: this.createCaller("get_bridge_data"),
		}
	}

	public async deploy(secretKey: Uint8Array): Promise<contract.MethodSender> {
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
			cell.bits.writeBytes(this.options.publicKey)
		}
		cell.bits.writeGrams(0) // total_locked
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
