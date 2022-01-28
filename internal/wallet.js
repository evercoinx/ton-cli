const fs = require("fs").promises
const tonMnemonic = require("tonweb-mnemonic")
const { BN } = require("tonweb").utils

class Wallet {
    constructor(tonweb, workchain) {
        this.tonweb = tonweb
        this.workchain = workchain
    }

    async predeploy() {
        try {
            const mnemonic = await tonMnemonic.generateMnemonic()
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

            const wallet = this.tonweb.wallet.create({
                publicKey: keyPair.publicKey,
                wc: this.workchain,
            })

            const address = await wallet.getAddress()
            const bouncableAddress = address.toString(true, true, true)
            await this.saveMnemonic(bouncableAddress, mnemonic)

            const deployRequest = await wallet.deploy(keyPair.secretKey)

            const feeResponse = await deployRequest.estimateFee()
            this.printFees(feeResponse)

            const nonBouncableAddress = address.toString(true, true, false)
            console.log(
                `Wallet is ready to be deployed at ${nonBouncableAddress}`,
            )
        } catch (err) {
            console.error(`Error! ${err}`)
        }
    }

    async deploy(walletAddress) {
        try {
            const mnemonic = await this.loadMnemonic(walletAddress)
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

            const wallet = this.tonweb.wallet.create({
                publicKey: keyPair.publicKey,
                wc: this.workchain,
            })

            const deployRequest = await wallet.deploy(keyPair.secretKey)

            const feeResponse = await deployRequest.estimateFee()
            this.printFees(feeResponse)

            const response = await deployRequest.send()
            this.printResponse(response, `Wallet was deployed successfully`)
        } catch (err) {
            console.error(`Error! ${err}`)
        }
    }

    async info(walletAddress) {
        try {
            const wallet = this.tonweb.wallet.create({ address: walletAddress })

            const address = await wallet.getAddress()
            const seqno = await wallet.methods.seqno().call()
            const balance = await this.tonweb.getBalance(walletAddress)

            console.log(`\nWallet information:`)
            console.log(`- Raw address: ${address.toString(false, true, true)}`)
            console.log(
                `- Bouncable address: ${address.toString(true, true, true)}`,
            )
            console.log(
                `- Non-bouncable address: ${address.toString(
                    true,
                    true,
                    false,
                )}`,
            )
            console.log(`- Balance: ${this.formatAmount(balance)}`)
            console.log(`- Sequence number: ${seqno || "0"}`)
        } catch (err) {
            console.error(`Error! ${err}`)
        }
    }

    async transfer(sender, recipient, amount) {
        try {
            const mnemonic = await this.loadMnemonic(sender)
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

            const wallet = this.tonweb.wallet.create({
                publicKey: keyPair.publicKey,
                wc: this.workchain,
            })

            const amountNano = this.tonweb.utils.toNano(amount)
            const senderBalance = await this.tonweb.getBalance(sender)
            if (amountNano.gt(new BN(senderBalance))) {
                throw new Error(
                    `Error! Transfer amount ${this.formatAmount(
                        amountNano,
                    )} exceeds balance ${this.formatAmount(senderBalance)}`,
                )
            }

            const seqno = await wallet.methods.seqno().call()
            const transferRequest = wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: recipient,
                amount: amountNano,
                seqno: seqno,
                payload: "Transfer",
                sendMode: 3,
            })

            const feeResponse = await transferRequest.estimateFee()
            this.printFees(feeResponse)

            const transferResponse = await transferRequest.send()
            this.printResponse(
                transferResponse,
                `${this.formatAmount(
                    amountNano,
                )} were transferred successfully`,
            )
        } catch (err) {
            console.error(`Error! ${err}`)
        }
    }

    async saveMnemonic(address, newMnemonic) {
        const fileContents = await fs.readFile("../mnemonic.json")
        const mnemonic = JSON.parse(fileContents)

        mnemonic[address] = newMnemonic
        await fs.writeFile("mnemonic.json", JSON.stringify(mnemonic, null, 4))
    }

    async loadMnemonic(address) {
        const fileContents = await fs.readFile("../mnemonic.json")
        const mnemonic = JSON.parse(fileContents)

        const walletMnemonic = mnemonic[address]
        if (!walletMnemonic) {
            throw new Error(`Wallet mnemonic is not found`)
        }

        const validMnemonic = await tonMnemonic.validateMnemonic(walletMnemonic)
        if (!validMnemonic) {
            throw new Error(`Mnemonic is invalid`)
        }

        return mnemonic
    }

    formatAmount(amount) {
        return `${this.tonweb.utils.fromNano(amount)} TON`
    }

    printFees(response) {
        if (response["@type"] !== "query.fees") {
            console.error(
                `Error! Code: ${response.code}, message: ${response.message}`,
            )
            return
        }

        const fees = response["source_fees"]
        console.log(`Fees:`)
        console.log(`- Gas fee:        ${this.formatAmount(fees["gas_fee"])}`)
        console.log(
            `- In-Forward fee: ${this.formatAmount(fees["in_fwd_fee"])}`,
        )
        console.log(`- Forward fee:    ${this.formatAmount(fees["fwd_fee"])}`)
        console.log(
            `- Storage fee:    ${this.formatAmount(fees["storage_fee"])}`,
        )
    }

    printResponse(response, successMessage) {
        if (response["@type"] !== "ok") {
            console.error(
                `Error! Code: ${response.code}, message: ${response.message}`,
            )
            return
        }
        console.log(successMessage)
    }
}

module.exports = Wallet
