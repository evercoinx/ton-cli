const TonWeb = require("tonweb")

const {
	Contract,
	boc: { Cell },
	utils: { nacl },
} = TonWeb

class Lottery extends Contract {
	constructor(provider, options) {
		options.code = Cell.oneFromBoc(
			"B5EE9C7241010C0100F8000114FF00F4A413F4BCF2C80B01020120020302014804050394F220C7009130E08308D71820D31FDB3C51A8BAF2A10AF9015410B6F910F2A206D30621C0018EA131383881012027D749BAF2A3F80006D21FD3FF3004A40810375E324144DB3CED54E30E080B090202CE06070105A12D810A00034308002D5708100C4C8CB0814CA0712CBFF01FA02CB6AC973FB008002CED44D0D31FD3FFD31FD31FFA00FA00D21FD3FFF404D1025801C0028F23FA00302082101DCD6500A0DB3CBCF264F800546990F00304A4081037405613DB3CED54925F0AE20A0B0008F8276F10003408C8CB1F17CBFF15CB1F13CB1F01FA0201FA02CA1FCBFFF400C9FBBDFD1B",
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
		}

		this.methods.balance = this.balance.bind(this)

		this.deploy = (secretKey) => {
			const res = Contract.createMethod(
				provider,
				this.createInitExternalMessage(secretKey),
			)
			return res
		}
	}

	async balance() {
		const myAddress = await this.getAddress()
		return this.provider.call2(myAddress.toString(), "balance")
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

			body: body,
			signature: signature,
			signingMessage: signingMessage,

			stateInit,
			code,
			data,
		}
	}
}

export default Lottery
