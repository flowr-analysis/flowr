import { Feature } from '../feature'
import { CommentInfo } from './comments'

export type FunctionNameInfo = string

export const functions: Feature<CommentInfo> = {
  name:        'functions',
  description: 'all functions defined within the document',

  append(existing: CommentInfo, input: Document): CommentInfo {
    return existing
  },

  toString(data: CommentInfo): string {
    return `---defined functions------------`
  }

}
