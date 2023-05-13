import fs, { promises as fsPromise } from 'fs'
import { RParseRequestFromFile } from '../r-bridge/retriever'
import path from 'path'
import { log } from './log'

/**
 * retrieves all files in the given directory recursively
 * @param dir - directory-path to start the search from
 * @param suffix - suffix of the files to be retrieved
 * based on {@link https://stackoverflow.com/a/45130990}
 */
async function* getFiles(dir: string, suffix = /.*/): AsyncGenerator<string> {
  const entries = await fsPromise.readdir(dir, { withFileTypes: true })
  for (const subEntries of entries) {
    const res = path.resolve(dir, subEntries.name)
    if (subEntries.isDirectory()) {
      yield* getFiles(res, suffix)
    } else if(suffix.test(subEntries.name)) {
      yield res
    }
  }
}

const rFileRegex = /\.[rR]$/

/**
 * Retrieves all R files in a given directory (asynchronously)
 *
 *
 * @param input - directory-path to start the search from, can be a file as well. Will just return the file then.
 * @param limit - limit the number of files to be retrieved
 *
 * @returns Number of files processed (normally &le; `limit`, is &ge; `limit` if limit was reached).
 *          Will be `1`, if `input` is an R file (and `0` if it isn't).
 *
 * @see #getFiles
 */
export async function* allRFiles(input: string, limit: number = Number.MAX_VALUE): AsyncGenerator<RParseRequestFromFile, number> {
  let count = 0
  if(fs.statSync(input).isFile()) {
    if(!rFileRegex.test(input)) {
      log.warn(`Input ${input} is not an R file`)
      return 0
    }
    yield { request: 'file', content: input }
    return 1
  }

  for await (const f of getFiles(input, rFileRegex)) {
    if (++count > limit) {
      return count
    }
    yield { request: 'file', content: f }
  }
  return count
}
