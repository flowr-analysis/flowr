import { Feature, formatMap } from '../feature'
import { PackageInfo, SinglePackageInfo } from './usedPackages'
import { MergeableRecord } from '../../util/objects'
import { UsedFunction } from './usedFunctions'
import * as xpath from 'xpath-ts'
import { guard, isNotNull, isNotUndefined } from '../../util/assert'
import { groupCount } from '../../util/arrays'

export interface CommentInfo extends MergeableRecord {
  totalAmount:       number
  roxygenComments:   number
  import:            SinglePackageInfo[]
  importFrom:        UsedFunction[]
  importMethodsFrom: UsedFunction[]
  // jeah, they refer to classes here, TODO: rename
  importClassesFrom: UsedFunction[]
  // TODO: deal with comma extras etc?
  useDynLib:         ( SinglePackageInfo | UsedFunction )[]
}

export const initialCommentInfo = () => ({
  totalAmount:       0,
  roxygenComments:   0,
  import:            [],
  importFrom:        [],
  importMethodsFrom: [],
  importClassesFrom: [],
  useDynLib:         []
})

const commentQuery = xpath.parse('//COMMENT')

const importRegex = /^'\s*@import\s+(?<package>\S+)/
const importFromRegex = /^'\s*@importFrom\s+(?<package>\S+)(?<fn>( +\S+)+)$/
const useDynLibRegex = /^'\s*@useDynLib\s+(?<package>\S+)(?<fn>( +\S+)+)?$/
/** we still name the classes fn, so we can reuse processing code */
const importClassesFromRegex = /^'\s*@importClassesFrom\s+(?<package>\S+)(?<fn>( +\S+)+)$/
const importMethodsFrom = /^'\s*@importMethodsFrom\s+(?<package>\S+)(?<fn>( +\S+)+)$/

function processRoxygenImport(existing: CommentInfo, comments: string[]) {
  existing.import.push(...comments.map(text => importRegex.exec(text)?.groups?.package).filter(isNotUndefined))
}

function processWithRegex(comments: string[], existing: CommentInfo, regex: RegExp) {
  const result = comments.map(text => regex.exec(text)).filter(isNotNull)
    .flatMap(match => {
      const packageName = match.groups?.package ?? '<unknown>'
      return (match.groups?.fn.trim().split(/\s+/) ?? []).map(fn => ({
        package:  packageName,
        function: fn
      }))
    })
  existing.importFrom.push(...result)
}

function processRoxygenImportFrom(existing: CommentInfo, comments: string[]) {
  processWithRegex(comments, existing, importFromRegex)
}

function processRoxygenImportClassesFrom(existing: CommentInfo, comments: string[]) {
  processWithRegex(comments, existing, importClassesFromRegex)
}

function processRoxygenImportMethodsFrom(existing: CommentInfo, comments: string[]) {
  processWithRegex(comments, existing, importMethodsFrom)
}

function processMatchForDynLib(match: RegExpExecArray): ( SinglePackageInfo | UsedFunction )[] {
  const packageName = match.groups?.package ?? '<unknown>'
  const functions = match.groups?.fn?.trim().split(/\s+/) ?? []
  if (functions.length === 0) {
    return [packageName]
  } else {
    return functions.map(fn => ({
      package:  packageName,
      function: fn
    }))
  }
}

function processRoxygenUseDynLib(existing: CommentInfo, comments: string[]) {
  const result: ( SinglePackageInfo | UsedFunction )[] = comments.map(text => useDynLibRegex.exec(text))
    .filter(isNotNull)
    .flatMap(processMatchForDynLib)
  existing.useDynLib.push(...result)
}

function processUsedFunction(data: (SinglePackageInfo | UsedFunction)[]) {
  return new Map([...groupCount(data)]
    .map(([key, value]) => {
      if(typeof key === 'string') {
        return [key, value]
      } else {
        return [`${key.package}::${key.function}`, value]
      }
    }))
}

export const comments: Feature<CommentInfo> = {
  name:        'comments',
  description: 'all comments that appear within the document',

  append(existing: CommentInfo, input: Document): CommentInfo {
    const comments = commentQuery.select({ node: input }).map(node => node.textContent ?? '#')
      .map(text => {
        guard(text.startsWith('#'), `unexpected comment ${text}`)
        return text.slice(1)
      })
      .map(text => text.trim())
    existing.totalAmount += comments.length

    const roxygenComments = comments.filter(text => text.startsWith("'"))
    existing.roxygenComments += roxygenComments.length

    processRoxygenImport(existing, roxygenComments)
    processRoxygenImportFrom(existing, roxygenComments)
    processRoxygenUseDynLib(existing, roxygenComments)
    processRoxygenImportClassesFrom(existing, roxygenComments)
    processRoxygenImportMethodsFrom(existing, roxygenComments)

    // TODO: others!

    return existing
  },

  toString(data: CommentInfo): string {
    // TODO: make more performant
    const groupedImportFrom = processUsedFunction(data.importFrom)
    const groupedDynLib = processUsedFunction(data.useDynLib)
    const groupedImportMethodsFrom = processUsedFunction(data.importMethodsFrom)
    const groupedImportClassesFrom = processUsedFunction(data.importClassesFrom)

    return `---comments-------------
\ttotal amount: ${data.totalAmount}
\troxygen comments: ${data.roxygenComments}
\timports (complete package, discouraged) (${data.import.length} times)${formatMap(groupCount(data.import))}
\timports from (${groupedImportFrom.size} times)${formatMap(processUsedFunction(data.importFrom))}
\timports classes from (S4) (${groupedImportClassesFrom.size} times)${formatMap(groupedImportClassesFrom)}
\timports methods from (S4, generic) (${groupedImportMethodsFrom.size} times)${formatMap(groupedImportMethodsFrom)}
\tused dynamic libs: (${groupedDynLib.size} times)${formatMap(groupedDynLib)}
    `
  }
}
