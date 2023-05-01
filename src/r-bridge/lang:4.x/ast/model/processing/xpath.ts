import { DOMParser } from 'xmldom'
import * as xpath from 'xpath'


export function countQueries(input: string, ...queries: string[]): number[] {
  const xml: Document = new DOMParser().parseFromString(input, 'text/xml')
  return queries.map(q => xpath.select(q, xml).length)
}
