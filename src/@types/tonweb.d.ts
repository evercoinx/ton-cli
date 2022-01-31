declare module "tonweb" {
	import * as BN from "bignumber.js"
	import nacl from "tweetnacl"

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

			public constructor(anyForm: string | Address)

			public toString(
				isUserFriendly = false,
				isUrlSafe = false,
				isBounceable = false,
				isTestonly = false,
			): string

			public static isValid(anyForm: string | Address): boolean
		}

		export function sha256(bytes: Uint8Array): Promise<ArrayBuffer>

		export function fromNano(amount: number | BN | string): string

		export function toNano(amount: number | BN | string): BN

		export function bytesToHex(buffer: Uint8Array): string

		export function hexToBytes(s: string): Uint8Array

		export function stringToBytes(str: string, size = 1): Uint8Array

		export function crc32c(bytes: Uint8Array): Uint8Array

		export function crc16(data: ArrayLike<number>): Uint8Array

		export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array

		export function compareBytes(a: Uint8Array, b: Uint8Array): boolean

		export function bytesToBase64(bytes: Uint8Array): string

		export function base64toString(base64: string): string

		export function stringToBase64(s: string): string

		export function base64ToBytes(base64: string): Uint8Array

		export function readNBytesUIntFromArray(
			n: number,
			ui8array: Uint8Array,
		): number
	}

	declare namespace boc {
		class BitString {
			public constructor(length: number)

			public getFreeBits(): number

			public getUsedBits(): number

			public getUsedBytes(): number

			public get(n: number): boolean

			public on(n: number): void

			public off(n: number): void

			public toggle(n: number): void

			public forEach(callback: (boolean) => void): void

			public writeBit(b: boolean | number): void

			public writeBitArray(ba: Array<boolean | number>): void

			public writeUint(number: number | BN, bitLength: number): void

			public writeInt(number: number | BN, bitLength: number): void

			public writeUint8(ui8: number): void

			public writeBytes(ui8: Uint8Array): void

			public writeString(s: string): void

			public writeGrams(amount: number | BN): void

			public writeAddress(address?: utils.Address | null): void

			public writeBitString(anotherBitString: BitString): void

			public clone(): BitString

			public toString(): string

			public getTopUppedArray(): Uint8Array

			public toHex(): string

			public setTopUppedArray(
				array: Uint8Array,
				fullfilledBytes = true,
			): void
		}

		interface CellObjectData {
			b64: string
			len: number
		}

		interface CellObject {
			data: CellObjectData
			refs: CellObjectData[]
		}

		export class Cell {
			public bits: BitString

			public constructor()

			public static fromBoc(serializedBoc: string | Uint8Array): Cell[]

			public static oneFromBoc(serializedBoc: string | Uint8Array): Cell

			public writeCell(anotherCell: Cell): void

			public getMaxLevel(): number

			public isExplicitlyStoredHashes(): number

			public getMaxDepth(): number

			public getMaxDepthAsArray(): Uint8Array

			public getRefsDescriptor(): Uint8Array

			public getBitsDescriptor(): Uint8Array

			public getDataWithDescriptors(): Uint8Array

			public getRepr(): Promise<Uint8Array>

			public hash(): Promise<Uint8Array>

			public toObject(): CellObject

			public print(indent: string): string

			public toBoc(
				hasIdx = true,
				hashCrc32 = true,
				hasCacheBits = false,
				flags = 0,
			): Promise<Uint8Array>

			public serializeForBoc(
				cellsIndex: any,
				refSize: null,
			): Promise<Uint8Array>
		}
	}

	type MethodId = string | number

	type CallMethodParams = [string, any][]

	export class HttpProvider {
		public constructor(host: string)

		public send(method: string, params: any[]): Promise<any>

		public getAddressInfo(address: string): Promise<any>

		public getExtendedAddressInfo(address: string): Promise<any>

		public getWalletInfo(address: string): Promise<any>

		getTransactions(
			address: utils.Address | string,
			limit = 20,
			lt?: number,
			txHash?: string,
			toLt?: number,
		): Promise<any[]>

		public async getBalance(
			address: utils.Address | string,
		): Promise<string>

		public sendBoc(bytes: Uint8Array): Promise<any>

		public call(
			address: utils.Address | string,
			method: MethodId,
			params: CallMethodParams = [],
		): Promise<any>

		public call2(
			address: string,
			method: MethodId,
			params: CallMethodParams = [],
		): Promise<any>

		public getMasterchainInfo(): Promise<any>

		public getBlockShards(masterchainBlockNumber: number): Promise<any[]>

		public getBlockTransactions(
			workchain: number,
			shardId: string,
			shardBlockNumber: number,
		): Promise<any[]>

		public getMasterchainBlockTransactions(
			masterchainBlockNumber: number,
		): Promise<any[]>

		public getBlockHeader(
			workchain: number,
			shardId: string,
			shardBlockNumber: number,
		): Promise<any>

		public getMasterchainBlockHeader(
			masterchainBlockNumber: number,
		): Promise<any>
	}

	declare namespace contract {
		export interface StateInit {
			stateInit: boc.Cell
			address: utils.Address
			code: boc.Cell
			data: boc.Cell
		}

		export interface InitExternalMessage extends StateInit {
			message: boc.Cell
			body: boc.Cell
			signingMessage: boc.Cell
		}

		export interface ExternalMessage {
			address: utils.Address
			message: boc.Cell
			body: boc.Cell
			signature: Uint8Array
			signingMessage: boc.Cell
			stateInit?: boc.Cell
			code?: boc.Cell
			data?: boc.Cell
		}

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

			protected createStateInit(): Promise<StateInit>

			public static createStateInit(
				code: boc.Cell,
				data: boc.Cell,
				library?: boc.Cell,
				splitDepth?: boc.Cell,
				tickTock?: boc.Cell,
			): Promise<boc.Cell>

			public static createExternalMessageHeader(
				dest: utils.Address | string,
				src?: utils.Address | string,
				importFee?: number | BN = 0,
			): boc.Cell

			public static createInternalMessageHeader(
				dest: utils.Address | string,
				gramValue?: number | BN = 0,
				ihrDisabled? = true,
				bounce?: boolean,
				bounced? = false,
				src?: utils.Address | string,
				currencyCollection: undefined,
				ihrFees?: number | BN = 0,
				fwdFees?: number | BN = 0,
				createdLt?: number | BN = 0,
				createdAt?: number | BN = 0,
			): boc.Cell

			public static createCommonMsgInfo(
				header: boc.Cell,
				stateInit?: boc.Cell,
				body?: boc.Cell,
			): boc.Cell

			public static createMethod(
				provider: HttpProvider,
				queryPromise: Promise,
			): Promise<MethodSender>
		}

		class WalletContract extends Contract {
			public deploy(secretKey: Uint8Array): Promise<MethodSenderRequest>
		}

		export class Wallets {
			public all: {
				[version: string]: typeof WalletContract
			}

			public list: typeof WalletContract[]
			public defaultVersion: string
			public default: typeof WalletContract

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
		// public BlockSubscription
		// public InMemoryBlockStorage
		public wallet: typeof contract.Wallets

		public constructor(public provider: HttpProvider)

		getTransactions(
			address: utils.Address | string,
			limit = 20,
			lt?: number,
			txHash?: string,
			toLt?: number,
		): Promise<any[]>

		public async getBalance(
			address: utils.Address | string,
		): Promise<string>

		public sendBoc(bytes: Uint8Array): Promise<any>

		public call(
			address: utils.Address | string,
			method: MethodId,
			params: CallMethodParams = [],
		): Promise<any>
	}
}
