import path from 'path'
import fs from 'fs'

/**
 * as we have a lot of data to collect, we want to store them in files
 *
 * @param name - the name of the feature {@link Feature#name}
 * @param fn - the name of the feature-aspect to record
 */
export function statisticsFile(name: string, fn: string): string {
  return `./statistics-out/${name}/${fn}.txt`
}

// TODO: guard etc.
export function resetStatisticsDirectory() {
  if(fs.existsSync('./statistics-out')) {
    fs.rmSync('./statistics-out', { recursive: true })
  }
}

/**
 * append the content of all nodes to the storage file for the given feature
 * @param name - the name of the feature {@link Feature#name}
 * @param fn - the name of the feature-aspect to record
 * @param nodes - the nodes to append, you may pass already transformed string contents
 * @param context - the context of the information retrieval (e.g. the name of the file that contained the R source code)
 */
export function append<T>(name: string, fn: keyof T, nodes: string[] | Node[], context: string | undefined) {
  if(nodes.length === 0) {
    return
  }
  let contents = typeof nodes[0] === 'string' ?
      nodes as string[]
    : (nodes as Node[]).map(node => node.textContent ?? '<unknown>')

  if(context !== undefined) {
    contents = contents.map(c => `${c}\t\t(${JSON.stringify(context)})`)
  }

  const filepath = statisticsFile(name, String(fn))

  const dirpath = path.dirname(filepath)
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true })
  }



  fs.appendFileSync(filepath, contents.join('\n') + '\n')
}
