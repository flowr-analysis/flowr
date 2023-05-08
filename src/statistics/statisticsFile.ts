import path from 'path'
import fs from 'fs'
import { date2string } from '../util/time'

export const statisticsDirectory = `./statistics-out-${date2string(new Date())}`

/**
 * as we have a lot of data to collect, we want to store them in files
 *
 * @param name - the name of the feature {@link Feature#name}
 * @param fn - the name of the feature-aspect to record
 */
export function statisticsFile(name: string, fn: string): string {
  return path.join(statisticsDirectory, name, `${fn}.txt`)
}

// TODO: guard existing etc. so that we do not remove wanted stuff
export function resetStatisticsDirectory() {
  if(fs.existsSync(statisticsDirectory)) {
    fs.rmSync(statisticsDirectory, { recursive: true })
  }
}

// requires to attach source information!
function extractNodeContent(node: Node): string {
  let result = node.textContent

  if(node.hasChildNodes()) {
    const firstChild = node.childNodes.item(0)
    if(firstChild.nodeType === 3 /* text node */) {
      result = firstChild.textContent
    }
  }

  return result?.replace('\n', '\\n') ?? '<unknown>'
}


/**
 * append the content of all nodes to the storage file for the given feature
 * @param name - the name of the feature {@link Feature#name}
 * @param fn - the name of the feature-aspect to record
 * @param nodes - the nodes to append, you may pass already transformed string contents
 * @param context - the context of the information retrieval (e.g. the name of the file that contained the R source code)
 * @param unique - should duplicate entries be removed on addition
 */
export function append<T>(name: string, fn: keyof T, nodes: string[] | Node[], context: string | undefined, unique = false ) {
  if(nodes.length === 0) {
    return
  }
  let contents = typeof nodes[0] === 'string' ?
      nodes as string[]
    : (nodes as Node[]).map(extractNodeContent)

  if(unique) {
    contents = [...new Set(contents)]
  }

  // console.log(name, fn, JSON.stringify(contents))

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
