import tonMnemonic = require("tonweb-mnemonic")
import TonWeb from "tonweb"

import AbstractLifecycle, { NodeResponse, FeeResponse } from "./abstract"
import Lottery from "../contract/lottery"

const { Address } = TonWeb.utils

class LotteryLifecycle extends AbstractLifecycle {
	public constructor(protected tonweb: typeof TonWeb) {
		super(tonweb)
	}

	public async prepare(workchain: number): Promise<void> {
		try {
			console.log(`\nLottery preparation operation:`)

			const mnemonic = await tonMnemonic.generateMnemonic()
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const lottery = new Lottery(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: workchain,
			})

			const address = await lottery.getAddress()
			const bounceableAddress = address.toString(true, true, true)
			await this.saveMnemonic(bounceableAddress, mnemonic)

			const deployRequest = await lottery.deploy(keyPair.secretKey)

			const feeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const nonBounceableAddress = address.toString(true, true, false)
			console.log(
				`Lottery is ready to be deployed at ${nonBounceableAddress}`,
			)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	public async deploy(address: string): Promise<void> {
		try {
			console.log(`\nLottery deployment operation:`)

			const lotteryAddress = new Address(address)
			if (!lotteryAddress.isUserFriendly) {
				throw new Error(
					`Lottery address should be in user friendly format`,
				)
			}
			if (!lotteryAddress.isBounceable) {
				throw new Error(`Wallet address should be bounceable`)
			}

			const mnemonic = await this.loadMnemonic(address)
			const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

			const lottery = new Lottery(this.tonweb.provider, {
				publicKey: keyPair.publicKey,
				wc: lotteryAddress.wc,
			})

			const deployRequest = await lottery.deploy(keyPair.secretKey)

			const feeResponse: FeeResponse = await deployRequest.estimateFee()
			this.printFees(feeResponse)

			const response: NodeResponse = await deployRequest.send()
			if (response["@type"] !== "ok") {
				throw new Error(
					`Code: ${response.code}, message: ${response.message}`,
				)
			}
			console.log(`Lottery was deployed successfully`)
		} catch (err: unknown) {
			this.printError(err)
		}
	}

	public async info(address: string): Promise<void> {
		try {
			console.log(`\nLottery information:`)

			const lotteryAddress = new Address(address)
			const lottery = new Lottery(this.tonweb.provider, {
				address: lotteryAddress,
			})

			const seqno: number | null = await lottery.methods.seqno().call()
			const balance = await this.tonweb.getBalance(address)

			console.log(
				`- Raw lottery address: ${lotteryAddress.toString(
					false,
					true,
					true,
				)}`,
			)
			console.log(
				`- Non-bounceable address (for init):     ${lotteryAddress.toString(
					true,
					true,
					false,
				)}`,
			)
			console.log(
				`- Bounceable address (for later access): ${lotteryAddress.toString(
					true,
					true,
					true,
				)}`,
			)
			console.log(`- Balance: ${this.formatAmount(balance)}`)
			console.log(`- Sequence number: ${seqno || "0"}`)
		} catch (err: unknown) {
			this.printError(err)
		}
	}
}

export default LotteryLifecycle
