const TonWeb = require("tonweb")

const {
	Contract,
	boc: { Cell },
	utils: { nacl },
} = TonWeb

class Example extends Contract {
	constructor(provider, options) {
		options.code = Cell.oneFromBoc(
			"B5EE9C72410108010072000114FF00F4A413F4BCF2C80B0102012002030201480405006EF28308D71820D31FED44D0D31FD3FFD15131BAF2A103F901541042F910F2A2F8005120D74A96D307D402FB00DED1A4C8CB1FCBFFC9ED540004D03002014806070017BB39CED44D0D31F31D70BFF80011B8C97ED44D0D70B1F8E93924A9",
		)
		super(provider, options)

		this.methods = {
			seqno: () => {
				return {
					call: async () => {
						const address = await this.getAddress()
						let n = null
						try {
							n = (
								await provider.call2(
									address.toString(),
									"seqno",
								)
							).toNumber()
						} catch (e) {}
						return n
					},
				}
			},
			getPublicKey: () => {
				return {
					call: async () => {
						const address = await this.getAddress()
						let pk = null
						try {
							pk = await provider.call2(
								address.toString(),
								"get_public_key",
							)
						} catch (e) {}
						return pk
					},
				}
			},
		}

		this.deploy = (secretKey) =>
			Contract.createMethod(
				provider,
				this.createInitExternalMessage(secretKey),
			)
	}

	createDataCell() {
		const cell = new Cell()
		cell.bits.writeUint(0, 32) // seqno
		cell.bits.writeBytes(this.options.publicKey)
		return cell
	}

	createSigningMessage(seqno = 0) {
		const cell = new Cell()
		cell.bits.writeUint(seqno, 32)
		return cell
	}

	async createInitExternalMessage(secretKey) {
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
		const externalMessage = Contract.createCommonMsgInfo(
			header,
			stateInit,
			body,
		)

		return {
			address: address,
			message: externalMessage,

			body,
			signingMessage,
			stateInit,
			code,
			data,
		}
	}

	async createExternalMessage(
		signingMessage,
		secretKey,
		seqno,
		dummySignature = false,
	) {
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

		const selfAddress = await this.getAddress()
		const header = Contract.createExternalMessageHeader(selfAddress)
		const resultMessage = Contract.createCommonMsgInfo(
			header,
			stateInit,
			body,
		)

		return {
			address: selfAddress,
			message: resultMessage, // old wallet_send_generate_external_message

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
