import { removeRQuotes } from '../../../../retriever'
import { guard } from '../../../../../util/assert'
import { RawRType } from '../../model/type'

export const RootId = 0

/**
 * Entry type - shared between CSV and JSON entries.
 * These include position, token, and text.
 */
interface Entry extends Record<string, unknown> {
	readonly line1: number,
	readonly col1:  number,
	readonly line2: number,
	readonly col2:  number,
	readonly token: string,
	readonly text:  string
}

/**
 * CsvEntry type - mapping of ParsedDataRow to a JS object structure.
 * Contains construction information - whether we deal with a terminal, IDs, and children.
 */
export interface CsvEntry extends Entry {
	readonly id:       number,
	readonly parent:   number,
	readonly terminal: boolean,
	children?:         CsvEntry[]
}

/**
 * Type-safe object structure that we work with during normalization.
 * Has Children (empty list indicates no children).
 */
export interface JsonEntry extends Entry {
	readonly children: JsonEntry[]
}

/**
 * Named JSON entries - these also have a RawRType assigned to them.
 */
export interface NamedJsonEntry {
	name:    RawRType
	content: JsonEntry
}

type ParsedDataRow = [line1: number, col1: number, line2: number, col2: number, id: number, parent: number, token: string, terminal: boolean, text: string]

export function prepareParsedData(data: string): CsvEntry[] {
	let json: unknown
	try {
		json = JSON.parse(`[${data}]`)
	} catch(e) {
		throw new Error(`Failed to parse data ${data}: ${(e as Error)?.message}`)
	}
	guard(Array.isArray(json), () => `Expected ${data} to be an array but was not`)

	const ret = new Map<number, CsvEntry>((json as ParsedDataRow[]).map(([line1, col1, line2, col2, id, parent, token, terminal, text]) => {
		return [id, { line1, col1, line2, col2, id, parent, token: removeRQuotes(token), terminal, text }] satisfies [number, CsvEntry]
	}))

	const roots: CsvEntry[] = []

	// iterate a second time to set parent-child relations (since they may be out of order in the csv)
	for(const entry of ret.values()) {
		if(entry.parent != RootId) {
			const parent = ret.get(entry.parent)
			if(parent) {
				parent.children ??= []
				parent.children.push(entry)
			}
		} else {
			roots.push(entry)
		}
	}

	return roots
}

export function convertPreparedParsedData(roots: CsvEntry[]): JsonEntry {
	// Locate start, end of source file (order children in advance).
	const rootEntries = roots.sort(orderOf)
	const start = rootEntries[0]
	const end = rootEntries[rootEntries.length - 1]

	// Construct CsvEntry for the root, handling empty input.
	const csvParent: CsvEntry = {
		line1:    start?.line1 ?? 1,
		col1:     start?.col1 ?? 1,
		line2:    end?.line2 ?? 1,
		col2:     end?.col2 ?? 1,
		token:    RawRType.ExpressionList,
		text:     '',
		id:       RootId,
		parent:   RootId,
		terminal: false,
		children: rootEntries,
	}
	// Return actual value.
	return convertEntry(csvParent)
}

function convertEntry(csvEntry: CsvEntry): JsonEntry {
	return {
		...csvEntry,
		// check and recursively iterate children
		children: csvEntry.children?.sort(orderOf).map(convertEntry) ?? []
	}
}

/**
 * we sort children the same way xmlparsedata does (by line, by column, by inverse end line, by inverse end column, by terminal state, by combined "start" tiebreaker value)
 * (https://github.com/r-lib/xmlparsedata/blob/main/R/package.R#L153C72-L153C78)
 */
function orderOf(c1: CsvEntry, c2: CsvEntry): number {
	return c1.line1 - c2.line1 || c1.col1 - c2.col1 || c2.line2 - c1.line2 || c2.col2 - c1.col2 || Number(c1.terminal) - Number(c2.terminal) || sortTiebreak(c1) - sortTiebreak(c2)
}

function sortTiebreak(entry: CsvEntry) {
	// see https://github.com/r-lib/xmlparsedata/blob/main/R/package.R#L110C5-L110C11
	return entry.line1 * (Math.max(entry.col1, entry.col2) + 1) + entry.col1
}
