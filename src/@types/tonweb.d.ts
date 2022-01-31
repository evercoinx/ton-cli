declare module "tonweb" {
	import * as BN from "bignumber.js"
	import nacl from "tweetnacl"

	export class HttpProvider {
		public constructor(host: string)

		public call2(
			address: string,
			method: string | number,
			params: [string, any][] = [],
		): any
	}

	declare namespace boc {
		class BitString {
			public constructor(length: number)

			public writeUint(number: number | BN, bitLength: number): void

			public writeInt(number: number | BN, bitLength: number): void

			public writeBytes(ui8: Uint8Array): void
		}

		export class Cell {
			public bits: BitString

			public constructor()

			public static fromBoc(serializedBoc: string | Uint8Array): Cell[]

			public static oneFromBoc(serializedBoc: string | Uint8Array): Cell

			public writeCell(anotherCell: Cell): void

			public hash(): Promise<Uint8Array>
		}
	}

	declare namespace utils {
		export const BN: BN

		export const nacl: nacl

		export class Address {
			wc: number
			hashPart: string
			isUserFriendly: boolean
			isUrlSafe: boolean
			isBounceable: boolean
			isTestonly: boolean

			public constructor(anyForm: string)

			public toString(
				isUserFriendly = false,
				isUrlSafe = false,
				isBounceable = false,
				isTestonly = false,
			): string
		}

		export function toNano(amount: number | BN | string): BN

		export function fromNano(amount: number | BN | string): string

		export function bytesToHex(buffer: Uint8Array): string

		export function hexToBytes(s: string): Uint8Array
	}

	declare namespace contract {
		export interface MethodCallerRequest {
			call: () => Promise<any>
		}
		export type MethodCaller = () => MethodCallerRequest

		export interface MethodSenderRequest {
			send: () => Promise<any>
			getQuery: () => Promise<any>
			estimateFee: () => Promise<any>
		}
		export type MethodSender = (params?: Object) => MethodSenderRequest

		export interface Methods {
			[methodName: string]: MethodCaller | MethodSender
		}

		export interface Options {
			code?: boc.Cell
			publicKey?: Uint8Array
			wc?: number
			address?: utils.Address | string
		}

		export class Contract {
			public address: utils.Address
			public methods: Methods

			public constructor(
				public provider: HttpProvider,
				public options: Options,
			)

			public getAddress(): Promise<utils.Address>

			private createCodeCell(): boc.Cell

			protected createDataCell(): boc.Cell

			protected createStateInit(): Promise<any>

			public static createExternalMessageHeader(
				dest: utils.Address | string,
				src?: utils.Address | string | null = null,
				importFee: number | BN = 0,
			): boc.Cell

			public static createCommonMsgInfo(
				header: boc.Cell,
				stateInit?: boc.Cell | null = null,
				body?: boc.Cell | null = null,
			): boc.Cell

			public static createMethod(
				provider: HttpProvider,
				queryPromise: Promise<any>,
			): Promise<MethodSender>
		}

		export interface InitExternalMessage {
			address: utils.Address
			message: boc.Cell
			body: boc.Cell
			signingMessage: boc.Cell
			stateInit: boc.Cell
			code: boc.Cell
			data: boc.Cell
		}

		export interface ExternalMessage {
			address: utils.Address
			message: boc.Cell
			body: boc.Cell
			signature: Uint8Array
			signingMessage: boc.Cell
			stateInit?: boc.Cell | null
			code?: boc.Cell | null
			data?: boc.Cell | null
		}

		class WalletContract extends Contract {
			public deploy(secretKey: Uint8Array): Promise<MethodSenderRequest>
		}

		export class Wallets {
			public all: {
				[version: string]: typeof WalletContract
			}

			public defaultVersion: string

			public constructor(public provider: HttpProvider)

			public static create(options: contract.Options): WalletContract
		}
	}

	export default class TonWeb {
		public static version: string
		public static utils: utils
		public static Address: typeof utils.Address
		public static boc: boc
		public static Contract: typeof contract.Contract
		public static HttpProvider: typeof HttpProvider
		public static Wallets: typeof contract.Wallets

		public version: string
		public utils: utils
		public Address: typeof utils.Address
		public boc: boc
		public Contract: typeof contract.Contract
		public wallet: typeof contract.Wallets

		public constructor(public provider: HttpProvider)

		public async getBalance(
			address: utils.Address | string,
		): Promise<string>
	}
}
