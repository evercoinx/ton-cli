import { boc, Contract, contract, providers, utils } from "tonweb"

class Bridge extends Contract {
	public constructor(
		provider: providers.HttpProvider,
		options: contract.Options,
	) {
		const code = boc.Cell.oneFromBoc(
			"B5EE9C7241021301000219000114FF00F4A413F4BCF2C80B01020120020302014804050262F28308D71820DB3C07D31F5218BAF2A108F901541095F910F2A204D31F01926C718E8CF80006A4061035447703DB3CE2D111120202CC06070115A1A973B67807F488AA40091102012008090201480A0B016FD00E8698180B8D8492F81F07D201810E38049897805F000E98F90CA18ACF805F09981699F9811418F584744C20FA009B840206D9E70AF81C10002F6544CA848684830803CB8641400EA2049C42A4100A8006820201200C0D0201200E0F004F34C1C069B40830BFFCB852483042B729BE4830BFFCB8524830443729B80830BFC870442C3CB8526000790074C3C0604C1E2EBCB8524835D26AC09C14812A8023886A80C0BC0204E800E914C06EA38448B5D2B0006696F50C340835D26AC09C37B780F90C5B04A003A736CF151E4848FC0146A84830803CB84C94512802B232E7C532CFF260843011C333C0741C20C1DC60033232C0F2C072C204F2FFC4B2D84073C5B25C3EC00411840D44121000C1F6CF1C19A084017D78401CF6CF20111210005708B1C008F5D2B0006C2540B50C3400B780B4CDC0608A1CDDD85C151BC8EEBCB85220053C024074409C3C02A00044708018C8CB055007CF1658FA0215CB6A13CB1FCB3F21C2FF92CB1F9131E2C901FB00002CED44D0D31FD3FFFA00FA40FA00FA00D30D552003D158004606C8CB1F15CBFF5003FA0201CF16502320812710BCF2D1875AFA0258FA02CB0DC9ED54A06652EF",
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
