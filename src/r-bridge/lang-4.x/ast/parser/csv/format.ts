import {removeTokenMapQuotationMarks} from '../../../../retriever'

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

export function csvToRecord(csv: string[][]): Map<number, CsvEntry> {
	const ret = new Map<number, CsvEntry>()

	// parse csv into entries
	const headers = csv[0]
	for(let rowIdx = 1; rowIdx < csv.length; rowIdx++){
		const content: Record<string,string> = {}
		for(let col = 0; col < csv[rowIdx].length; col++){
			content[headers[col]] = csv[rowIdx][col]
		}
		const entry = content as CsvEntry
		entry.token = removeTokenMapQuotationMarks(entry.token)
		ret.set(entry.id, entry)
	}

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
