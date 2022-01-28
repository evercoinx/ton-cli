const fs = require("fs").promises
const tonMnemonic = require("tonweb-mnemonic")
const { BN, Address } = require("tonweb").utils

class Wallet {
    constructor(tonweb) {
        this.tonweb = tonweb
        this.mnemonicFilename = "mnemonic.json"
    }

    async predeploy(workchain) {
        try {
            console.log(`\nWallet predeployment operation:`)

            const mnemonic = await tonMnemonic.generateMnemonic()
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

            const wallet = this.tonweb.wallet.create({
                publicKey: keyPair.publicKey,
                wc: workchain,
            })

            const address = await wallet.getAddress()
            const bounceableAddress = address.toString(true, true, true)
            await this.saveMnemonic(bounceableAddress, mnemonic)

            const deployRequest = await wallet.deploy(keyPair.secretKey)

            const feeResponse = await deployRequest.estimateFee()
            this.printFees(feeResponse)

            const nonBounceableAddress = address.toString(true, true, false)
            console.log(
                `Wallet is ready to be deployed at ${nonBounceableAddress}`,
            )
        } catch (err) {
            console.error(`Error! ${err.message}`)
        }
    }

    async deploy(address) {
        try {
            console.log(`\nWallet deployment operation:`)

            const walletAddress = new Address(address)
            if (!walletAddress.isUserFriendly) {
                throw new Error(
                    `Wallet address should be in user friendly format`,
                )
            }
            if (!walletAddress.isBounceable) {
                throw new Error(`Wallet address should be bounceable`)
            }

            const mnemonic = await this.loadMnemonic(address)
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

            const wallet = this.tonweb.wallet.create({
                publicKey: keyPair.publicKey,
                wc: walletAddress.wc,
            })

            const deployRequest = await wallet.deploy(keyPair.secretKey)

            const feeResponse = await deployRequest.estimateFee()
            this.printFees(feeResponse)

            const response = await deployRequest.send()
            if (response["@type"] !== "ok") {
                throw new Error(
                    `Code: ${response.code}, message: ${response.message}`,
                )
            }
            console.log(`Wallet was deployed successfully`)
        } catch (err) {
            console.error(`Error! ${err.message}`)
        }
    }

    async info(address) {
        try {
            console.log(`\nWallet information:`)

            const walletAddress = new Address(address)
            const wallet = this.tonweb.wallet.create({
                address: walletAddress,
            })

            const seqno = await wallet.methods.seqno().call()
            const balance = await this.tonweb.getBalance(address)

            console.log(
                `- New wallet address: ${walletAddress.toString(
                    false,
                    true,
                    true,
                )}`,
            )
            console.log(
                `- Non-bounceable address (for init):     ${walletAddress.toString(
                    true,
                    true,
                    false,
                )}`,
            )
            console.log(
                `- Bounceable address (for later access): ${walletAddress.toString(
                    true,
                    true,
                    true,
                )}`,
            )
            console.log(`- Balance: ${this.formatAmount(balance)}`)
            console.log(`- Sequence number: ${seqno || "0"}`)
        } catch (err) {
            console.error(`Error! ${err.message}`)
        }
    }

    async transfer(sender, recipient, amount, stateinit, memo) {
        try {
            console.log(`\nTransfer operation between wallets:`)

            const recipientAddress = new Address(recipient)
            if (!recipientAddress.isUserFriendly) {
                throw new Error(
                    `Recipient's wallet address should be in user friendly format`,
                )
            }

            if (stateinit && recipientAddress.isBounceable) {
                throw new Error(
                    `Recipient's wallet address should be non-bounceable for state init operation`,
                )
            }

            if (!stateinit && !recipientAddress.isBounceable) {
                throw new Error(
                    `Recipient's wallet address should be bounceable for any not state init operation`,
                )
            }

            if (amount < 0) {
                throw new Error(`Amount should be positive`)
            }

            const mnemonic = await this.loadMnemonic(sender)
            const keyPair = await tonMnemonic.mnemonicToKeyPair(mnemonic)

            const wallet = this.tonweb.wallet.create({
                publicKey: keyPair.publicKey,
            })

            const amountNano = this.tonweb.utils.toNano(amount)
            const senderBalance = await this.tonweb.getBalance(sender)
            if (amountNano.gt(new BN(senderBalance))) {
                throw new Error(
                    `Transfer amount ${this.formatAmount(
                        amountNano,
                    )} exceeds balance ${this.formatAmount(senderBalance)}`,
                )
            }

            const seqno = await wallet.methods.seqno().call()
            const transferRequest = wallet.methods.transfer({
                secretKey: keyPair.secretKey,
                toAddress: recipientAddress,
                amount: amountNano,
                seqno,
                payload: memo,
                sendMode: 3,
            })

            const feeResponse = await transferRequest.estimateFee()
            this.printFees(feeResponse)

            const response = await transferRequest.send()
            if (response["@type"] !== "ok") {
                throw new Error(
                    `Code: ${response.code}, message: ${response.message}`,
                )
            }
            console.log(
                `${this.formatAmount(
                    amountNano,
                )} were transferred successfully`,
            )
        } catch (err) {
            console.error(`Error! ${err.message}`)
        }
    }

    async saveMnemonic(address, newMnemonic) {
        const fileContents = await fs.readFile(this.mnemonicFilename)
        const mnemonic = JSON.parse(fileContents)

        mnemonic[address] = newMnemonic
        await fs.writeFile(filename, JSON.stringify(mnemonic, null, 4))
        console.log(`Wallet mnemonic was saved to ${filename} file`)
    }

    async loadMnemonic(address) {
        const fileContents = await fs.readFile(this.mnemonicFilename)
        const mnemonic = JSON.parse(fileContents)

        const addressMnemonic = mnemonic[address]
        if (!addressMnemonic) {
            throw new Error(`Address mnemonic is not found`)
        }

        const valid = await tonMnemonic.validateMnemonic(addressMnemonic)
        if (!valid) {
            throw new Error(`Address mnemonic is invalid`)
        }

        return addressMnemonic
    }

    formatAmount(amount) {
        return `${this.tonweb.utils.fromNano(amount)} TON`
    }

    printFees(response) {
        if (response["@type"] !== "query.fees") {
            throw new Error(
                `Code: ${response.code}, message: ${response.message}`,
            )
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

    printResponse(response, successMessage) {}
}

module.exports = Wallet
