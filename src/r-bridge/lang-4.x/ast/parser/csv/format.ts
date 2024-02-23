import {removeTokenMapQuotationMarks} from '../../../../retriever'

export type ParsedCsv = Record<number, CsvEntry>

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

export function csvToRecord(csv: string[][]): ParsedCsv {
	const ret: ParsedCsv = {}

	// parse csv into entries
	const headers = csv[0]
	for(let rowIdx = 1; rowIdx < csv.length; rowIdx++){
		const content: Record<string,string> = {}
		for(let col = 1; col < csv[rowIdx].length; col++){
			// we start at column 1 here, because the 0th column has a second copy of the id that has a dummy header
			// (see https://github.com/Code-Inspect/flowr/issues/653)
			content[headers[col]] = csv[rowIdx][col]
		}
		const entry = content as CsvEntry
		entry.token = removeTokenMapQuotationMarks(entry.token)
		ret[entry.id] = entry
	}

	// iterate a second time to set parent-child relations (since they may be out of order in the csv)
	for(const entry of Object.values(ret)) {
		if(!isRoot(entry)) {
			const parent = ret[entry.parent]
			parent.children ??= []
			parent.children.push(entry)
		}
	}

	return ret
}

export function isRoot(entry: CsvEntry){
	return entry.parent == 0
}
