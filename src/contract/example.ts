import TonWeb, { HttpProvider, boc, contract } from "tonweb"

const {
	Contract,
	boc: { Cell },
	utils: { BN, nacl },
} = TonWeb

class Example extends Contract {
	public constructor(provider: HttpProvider, options: contract.Options) {
		const code = Cell.oneFromBoc(
			"B5EE9C72410108010072000114FF00F4A413F4BCF2C80B0102012002030201480405006EF28308D71820D31FED44D0D31FD3FFD15131BAF2A103F901541042F910F2A2F8005120D74A96D307D402FB00DED1A4C8CB1FCBFFC9ED540004D03002014806070017BB39CED44D0D31F31D70BFF80011B8C97ED44D0D70B1F8E93924A9",
		)
		super(provider, { ...options, code })

		this.methods = {
			seqno: this.createCaller("seqno"),
			getPublicKey: this.createCaller("get_public_key"),
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
					if (result instanceof BN) {
						result = result.toNumber()
					}
				} catch (e) {}
				return result
			},
		})
	}

	protected createDataCell(): boc.Cell {
		const cell = new Cell()
		cell.bits.writeUint(0, 32) // seqno

		if (!this.options.publicKey) {
			throw new Error("no public key in options")
		}
		cell.bits.writeBytes(this.options.publicKey)
		return cell
	}

	private createSigningMessage(seqno: number = 0): boc.Cell {
		const cell = new Cell()
		cell.bits.writeUint(seqno, 32)
		return cell
	}

	private async createInitExternalMessage(
		secretKey: Uint8Array,
	): Promise<contract.InitExternalMessage> {
		if (!this.options.publicKey) {
			const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey)
			this.options.publicKey = keyPair.publicKey
		}
		const { stateInit, address, code, data } = await this.createStateInit()

		const signingMessage = this.createSigningMessage()
		const signature = nacl.sign.detached(
			await signingMessage.hash(),
			secretKey,
		)

		const body = new Cell()
		body.bits.writeBytes(signature)
		body.writeCell(signingMessage)

		const header = Contract.createExternalMessageHeader(address)
		const message = Contract.createCommonMsgInfo(header, stateInit, body)

		return {
			address,
			message,
			body,
			signingMessage,
			stateInit,
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
			: nacl.sign.detached(await signingMessage.hash(), secretKey)

		const body = new Cell()
		body.bits.writeBytes(signature)
		body.writeCell(signingMessage)

		let stateInit = null
		let code = null
		let data = null

		if (seqno === 0) {
			if (!this.options.publicKey) {
				const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey)
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
			address,
			message,
			body,
			signature,
			signingMessage,
			stateInit,
			code,
			data,
		}
	}
}

export default Example
