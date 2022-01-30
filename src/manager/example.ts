import tonMnemonic = require("tonweb-mnemonic")
import TonWeb from "tonweb"

import AbstractContractManager, {
	CommonResponse,
	FeeResponse,
} from "./abstract"
import Example from "../contract/example"

const { Address } = TonWeb.utils

class ExampleManager extends AbstractContractManager {
	public constructor(protected tonweb: typeof TonWeb) {
		super(tonweb)
	}

	public async prepare(workchain: number): Promise<void> {
		try {
			console.log(`\nExample preparation operation:`)

			const mnemonic = await tonMnemonic.generateMnemonic()
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const example = new Example(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: workchain,
			})

			const address = await example.getAddress()
			const bounceableAddress = address.toString(true, true, true)
			await this.saveMnemonic(bounceableAddress, mnemonic)

			const deployRequest = await example.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const nonBounceableAddress = address.toString(true, true, false)
			console.log(
				`Example contract is ready to be deployed at ${nonBounceableAddress}`,
			)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	public async deploy(address: string): Promise<void> {
		try {
			console.log(`\nExample deployment operation:`)

			const exampleAddress = new Address(address)
			if (!exampleAddress.isUserFriendly) {
				throw new Error(
					`Contract address should be in user friendly format`,
				)
			}
			if (!exampleAddress.isBounceable) {
				throw new Error(`Contract address should be bounceable`)
			}

			const mnemonic = await this.loadMnemonic(address)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const example = new Example(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: exampleAddress.wc,
			})

			const deployRequest = await example.deploy(keyPair.secretKey)

			const feeResponse: FeeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const response: CommonResponse = await deployRequest.send()
			if (response["@type"] !== "ok") {
				throw new Error(
					`code: ${response.code}, message: ${response.message}`,
				)
			}
			console.log(`Example contract was deployed successfully`)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	public async info(address: string): Promise<void> {
		try {
			console.log(`\nExample information:`)

			const exampleAddress = new Address(address)
			const example = new Example(this.tonweb.provider, {
				address: exampleAddress,
			})

			const balance = await this.tonweb.getBalance(address)
			const seqno: number | null = await example.methods.seqno().call()
			const publicKey: string | null = await example.methods
				.getPublicKey()
				.call()

			this.printAddressInfo(exampleAddress)
			console.log(`- Balance: ${this.formatAmount(balance)}`)
			console.log(`- Sequence number: ${seqno}`)
			console.log(`- Public key: ${publicKey}`)
		} catch (err: unknown) {
			this.printError(err)
		}
	}
}

export default ExampleManager
