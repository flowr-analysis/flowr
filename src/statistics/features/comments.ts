import { Feature } from '../feature'
import { PackageInfo, SinglePackageInfo } from './usedPackages'
import { MergeableRecord } from '../../util/objects'
import { UsedFunction } from './usedFunctions'
import * as xpath from 'xpath-ts'
import { guard, isNotNull, isNotUndefined } from '../../util/assert'

export interface CommentInfo extends MergeableRecord {
  totalAmount:       number
  roxygenComments:   number
  import:            SinglePackageInfo[]
  importFrom:        UsedFunction[]
  importMethodsFrom: UsedFunction[]
  importClassesFrom: UsedFunction[]
  // TODO: deal with comments etc?
  useDynLib:         SinglePackageInfo[]
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

const importRegex = /@import\s+(?<package>\S+)/
const importFromRegex = /@importFrom\s+(?<package>\S+)(?<fn>( +\S+)+)$/


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

    existing.import.push(...comments.map(text => importRegex.exec(text)?.groups?.package).filter(isNotUndefined))
    existing.importFrom.push(...
    comments.map(text => importFromRegex.exec(text)).filter(isNotNull)
      .map(match => ({ package: match.groups?.package ?? '<unknown>', functions: match.groups?.fn.trim().split(/\s+/) ?? [] }))
    )

    // TODO: others!

    return existing
  },

  toString(data: CommentInfo): string {
    let result = '---comments-------------'
    result += `\n\ttotal amount: ${data.totalAmount}`
    result += `\n\troxygen comments: ${data.roxygenComments}`
    result += `\n\timports: ${data.import.length}`
    result += `\n\timports from: ${data.importFrom.length}`
    result += `[TODO: others/more info]`
    return result
  }
}
