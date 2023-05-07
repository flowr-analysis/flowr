import { promises as fs } from 'fs'
import { resolve } from 'path'
import { RParseRequest, RParseRequestFromFile, RParseRequestFromText } from '../r-bridge/retriever'

/* */
/**
 * retrieves all files in the given directory recursively
 * @param dir - directory-path to start the search from
 *
 * based on {@link https://stackoverflow.com/a/45130990}
 */
export async function* getFiles(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const subEntries of entries) {
    const res = resolve(dir, subEntries.name)
    if (subEntries.isDirectory()) {
      yield* getFiles(res)
    } else {
      yield res
    }
  }
}


/**
 * Retrieves all R files in a given directory (asynchronously)
 *
 * @param dir - directory-path to start the search from
 * @param limit - limit the number of files to be retrieved
 *
 * @see #getFiles
 */
export async function* allRFiles(dir: string, limit: 'unlimited' | number = 'unlimited'): AsyncGenerator<RParseRequestFromFile> {
  const count = 0
  for await (const f of getFiles(dir)) {
    if (f.endsWith('.R')) {
      if(limit !== 'unlimited' && count >= limit) {
        break
      }
      yield { request: 'file', content: f }
    }
  }
}
