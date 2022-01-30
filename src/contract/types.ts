import TonWeb from "tonweb"

const {
	Address,
	HttpProvider,
	boc: { Cell },
} = TonWeb

export interface ContractOptions {
	publicKey?: Uint8Array
	wc?: number
	address?: typeof Address | string
}

export interface Contract {
	new (provider: typeof HttpProvider, options: ContractOptions): any
}

export interface InitExternalMessage {
	address: typeof Address
	message: typeof Cell
	body: typeof Cell
	signingMessage: typeof Cell
	stateInit: typeof Cell
	code: typeof Cell
	data: typeof Cell
}

export interface ExternalMessage {
	address: typeof Address
	message: typeof Cell
	body: typeof Cell
	signature: Uint8Array
	signingMessage: typeof Cell
	stateInit: typeof Cell
	code: typeof Cell
	data: typeof Cell
}

export type MethodCaller = () => {
	call: () => Promise<any>
}

export type MethodSender = () => {
	send: () => Promise<any>
	getQuery: () => Promise<any>
	estimateFee: () => Promise<any>
}
