import { Feature, formatMap } from '../feature'
import { SinglePackageInfo } from './usedPackages'
import { MergeableRecord } from '../../util/objects'
import { UsedFunction } from './usedFunctions'
import * as xpath from 'xpath-ts2'
import { guard, isNotNull, isNotUndefined } from '../../util/assert'
import { groupCount } from '../../util/arrays'

export interface CommentInfo extends MergeableRecord {
  totalAmount:       number
  roxygenComments:   number
  import:            SinglePackageInfo[]
  importFrom:        UsedFunction[]
  importMethodsFrom: UsedFunction[]
  // jeah, they refer to classes here, but we keep it to allow same processing to take place (in the end, they are entities)
  importClassesFrom: UsedFunction[]
  export:            number,
  exportClass:       number,
  exportMethod:      number,
  exportS3Method:    number,
  exportPattern:     number,
  // TODO: deal with comma extras etc?
  useDynLib:         ( SinglePackageInfo | UsedFunction )[]
}

export const initialCommentInfo = (): CommentInfo => ({
  totalAmount:       0,
  roxygenComments:   0,
  import:            [],
  importFrom:        [],
  importMethodsFrom: [],
  importClassesFrom: [],
  useDynLib:         [],
  export:            0,
  exportClass:       0,
  exportMethod:      0,
  exportS3Method:    0,
  exportPattern:     0
})

const commentQuery = xpath.parse('//COMMENT')

const importRegex = /^'\s*@import\s+(?<package>\S+)/
const importFromRegex = /^'\s*@importFrom\s+(?<package>\S+)(?<fn>( +\S+)+)$/
const useDynLibRegex = /^'\s*@useDynLib\s+(?<package>\S+)(?<fn>( +\S+)+)?$/
/** we still name the classes fn, so we can reuse processing code */
const importClassesFromRegex = /^'\s*@importClassesFrom\s+(?<package>\S+)(?<fn>( +\S+)+)$/
const importMethodsFrom = /^'\s*@importMethodsFrom\s+(?<package>\S+)(?<fn>( +\S+)+)$/

/** deliberately includes the others to get a "total" overview */
const exportRegex = /^'\s*@export/
const exportS3MethodRegex = /^'\s*@exportS3Method/
const exportClassRegex = /^'\s*@exportClass/
const exportMethodRegex = /^'\s*@exportMethod/
const exportPatternRegex = /^'\s*@exportPattern/



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

function processExports(existing: CommentInfo, comments: string[]) {
  existing.export += comments.filter(text => exportRegex.test(text)).length
  existing.exportClass += comments.filter(text => exportClassRegex.test(text)).length
  existing.exportMethod += comments.filter(text => exportMethodRegex.test(text)).length
  existing.exportS3Method += comments.filter(text => exportS3MethodRegex.test(text)).length
  existing.exportPattern += comments.filter(text => exportPatternRegex.test(text)).length
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
    processExports(existing, roxygenComments)

    return existing
  },

  toString(data: CommentInfo): string {
    // TODO: make more performant & improve formatting (tables etc.)
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
\texports:
\t\ttotal (+@export): ${data.export}
\t\t@exportClass: ${data.exportClass}
\t\t@exportMethod: ${data.exportMethod}
\t\t@exportS3Method: ${data.exportS3Method}
\t\t@exportPattern: ${data.exportPattern}
    `
  }
}
