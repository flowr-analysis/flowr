import { promises as fs } from 'fs'
import { resolve } from 'path'
import { RParseRequest, RParseRequestFromFile, RParseRequestFromText } from '../r-bridge/retriever'

/**
 * retrieves all files in the given directory recursively
 * @param dir - directory-path to start the search from
 * @param suffix - suffix of the files to be retrieved
 * based on {@link https://stackoverflow.com/a/45130990}
 */
async function* getFiles(dir: string, suffix = /.*/): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const subEntries of entries) {
    const res = resolve(dir, subEntries.name)
    if (subEntries.isDirectory()) {
      yield* getFiles(res, suffix)
    } else if(suffix.test(subEntries.name)) {
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
export async function* allRFiles(dir: string, limit: number = Number.MAX_VALUE): AsyncGenerator<RParseRequestFromFile> {
  let count = 0
  for await (const f of getFiles(dir, /\.[rR]$/)) {
    if(++count > limit) {
      break
    }
    yield { request: 'file', content: f }
  }
}
