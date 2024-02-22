import {removeTokenMapQuotationMarks} from '../../../../retriever'

export type ParsedCsv = Record<number, CsvEntry>

export interface CsvEntry extends Record<string, unknown> {
	line1:    number,
	col1:     number,
	line2:    number,
	col2:     number,
	id:       number,
	parent:   number,
	token:    string,
	terminal: boolean,
	text:     string
}

export function getChildren(csv: ParsedCsv, entry: CsvEntry): CsvEntry[]{
	return Object.values(csv).filter(v => v.parent == entry.id)
}

export function csvToRecord(csv: string[][]): ParsedCsv {
	const ret: ParsedCsv = {}
	const headers = csv[0]
	for(let rowIdx = 1; rowIdx < csv.length; rowIdx++){
		const content: Record<string,string> = {}
		for(let col = 1; col < csv[rowIdx].length; col++){
			// we start at column 1 here, because the 0th column has a second copy of the id that has a dummy header
			// (see https://github.com/Code-Inspect/flowr/issues/653)
			content[headers[col]] = removeTokenMapQuotationMarks(csv[rowIdx][col])
		}
		const entry = content as CsvEntry
		ret[entry.id] = entry
	}
	return ret
}
