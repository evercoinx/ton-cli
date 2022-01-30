interface CommonSuccessResponse {
	"@type": "ok"
	"@extra": string
}

interface ErrorResponse {
	"@type": "error"
	code: string
	message: string
	"@extra": string
}

export type CommonResponse = CommonSuccessResponse | ErrorResponse

export interface SourceFees {
	"@type": "fees"
	gas_fee: number
	in_fwd_fee: number
	fwd_fee: number
	storage_fee: number
}

interface FeeSuccessResponse {
	"@type": "query.fees"
	source_fees: SourceFees
	destination_fees: unknown[]
	"@extra": string
}

export type FeeResponse = FeeSuccessResponse | ErrorResponse
