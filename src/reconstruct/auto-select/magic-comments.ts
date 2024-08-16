import { RNode } from "../../r-bridge/lang-4.x/ast/model/model";
import { RComment } from "../../r-bridge/lang-4.x/ast/model/nodes/r-comment";
import { NormalizedAst, ParentInformation } from "../../r-bridge/lang-4.x/ast/model/processing/decorate";
import { visitAst } from "../../r-bridge/lang-4.x/ast/model/processing/visitor";
import { RType } from "../../r-bridge/lang-4.x/ast/model/type";
import { guard } from "../../util/assert";
import { SourceRange } from "../../util/range";
import { AutoSelectPredicate } from "./auto-select-defaults";

function getLoc({ location, info: { fullRange } }: RNode): SourceRange {
   const loc = location ?? fullRange
   guard(loc !== undefined, 'TODO: support location-less nodes!')
   return loc;
}

type MagicCommentConsumer = (n: RComment, stack: number[]) => number[] | undefined

const magicCommentIdMapper: Record<string, MagicCommentConsumer> = {
   'include_next_line': (n: RComment) => {
      return [getLoc(n)[0] + 1]
   },
   'include_this_line': (n: RComment) => {
      return [getLoc(n)[0]]
   },
   'include_start': (n: RComment, stack: number[]) => {
      stack.push(getLoc(n)[0] + 1)
      return undefined
   },
   'include_end': (n: RComment, stack: number[]) => {
      const to = getLoc(n)[0]
      guard(stack.length >= 1, `mismatched magic start and end at ${to}`)
      const from = stack.pop() as number
      const ret = new Array(to - from - 1)
      for(let i = from; i < to; i++) {
         ret[i - from] = i;
      }
      return ret;
   }
}

const commentTriggerRegex = / flowr@(\w+)/

/**
 * This takes an {@link NormalizedAst} and returns an auto-select predicate for {@link reconstructToCode},
 * which will automatically include lines marked by these special comments!
 * Please make sure to create one per source as it will use it to cache.
 *
 * We support two formats:
 * - Line comments in the form of `# flowr@include_next_line` or `# flowr@include_this_line`.
 * - Block comments which start with `# flowr@include_start` and end with `# flowr@include_end`.
 *   This supports nesting.
 *
 * Please note that these comments have to start exactly with this content to work.
 *
 * @param and - Predicate to composite this one with, If you do not pass a predicate, you may assume composition with
 *              {@link doNotAutoSelect}.
 */
export function makeMagicCommentHandler(and?: AutoSelectPredicate): AutoSelectPredicate {
   let lines: Set<number> | undefined = undefined;
   return (node: RNode<ParentInformation>, normalizedAst: NormalizedAst) => {
      if(!lines) {
         lines = new Set<number>()
         const startLineStack: number[] = []
         visitAst(normalizedAst.ast, n => {
            const comments = n.info.additionalTokens
            if (!comments) {
               return;
            }
            for(const c of comments) {
               if(c.type !== RType.Comment || !c.content.startsWith(' flowr@')) {
                  continue
               }
               const match = commentTriggerRegex.exec(c.content);
               guard(match !== null, `invalid magic comment: ${c.content}`);
               const idMapper = magicCommentIdMapper[match[1]];
               guard(idMapper !== undefined, `unknown magic comment: ${match[1]}`);
               const ls = idMapper(c, startLineStack);
               if (ls !== undefined) {
                  for (const l of ls) {
                     (lines as Set<number>).add(l)
                  }
               }
            }
         });
         guard(startLineStack.length === 0, `mismatched magic start and end at end of file (${JSON.stringify(startLineStack)})`);
      }
      // TODO: why no mach?
      console.log('XXXXXXX', lines)
      const loc = node.location ?? node.info.fullRange

      if(loc && lines.has(loc[0])) {
         return true;
      }
      return and?.(node, normalizedAst) ?? false;
   }
}


