import { removeTokenMapQuotationMarks } from '../../../../retriever'
import { guard } from '../../../../../util/assert'

export const RootId = 0

export interface CsvEntry extends Record<string, unknown> {
	line1:     number,
	col1:      number,
	line2:     number,
	col2:      number,
	id:        number,
	parent:    number,
	token:     string,
	terminal:  boolean,
	text:      string,
	children?: CsvEntry[]
}

type ParsedDataRow = [line1: number, col1: number, line2: number, col2: number, id: number, parent: number, token: string, terminal: boolean, text: string]

export function prepareParsedData(data: string): Map<number, CsvEntry> {
	const json: unknown = JSON.parse(data)
	guard(Array.isArray(json), () => `Expected ${data} to be an array but was not`)

	const ret = new Map<number, CsvEntry>((json as ParsedDataRow[]).map(([line1, col1, line2, col2, id, parent, token, terminal, text]) => {
		return [id, { line1, col1, line2, col2, id, parent, token: removeTokenMapQuotationMarks(token), terminal, text }] satisfies [number, CsvEntry]
	}))

	// iterate a second time to set parent-child relations (since they may be out of order in the csv)
	for(const entry of ret.values()) {
		if(entry.parent != RootId) {
			const parent = ret.get(entry.parent)
			if(parent) {
				parent.children ??= []
				parent.children.push(entry)
			}
		}
	}

	return ret
}
