const evaluator = new XPathEvaluator()

/** as xpath-ts etc. are somewhat incompatible with our ts setup, we use this almost trivial adapter */
export const xpath = {
  /** prepare a given xpath expression, does not have support for variables */
  parse(xpath: string): XPathExpression {
    return evaluator.createExpression(xpath, null)
  },

  /**
   * returns an unordered iterator of all retrieved results
   */
  * query(xpath: XPathExpression, node: Node): Generator<Node, void, void> {
    const res = xpath.evaluate(node, XPathResult.UNORDERED_NODE_ITERATOR_TYPE)
    let cur
    while ((cur = res.iterateNext()) !== null) {
      yield cur
    }
  },

  /**
   * short version of {@link xpath#query} which automatically returns the text content for all nodes,
   * or the default presented
   */
  queryAllContent(xpath: XPathExpression, node: Node, defaultValue = ''): string[] {
    return [...this.query(xpath, node)].map(n => n.textContent ?? defaultValue)
  },

  /**
   * simply returns the number of results
   */
  queryCount(xpath: XPathExpression, node: Node): number {
    let count = 0
    for(const _ of this.query(xpath, node)) {
      count++
    }
    return count
  }
}

export function withVariable(query: string, variableName: string, ...values: string[]): string[] {
  const result: string[] = []
  for(const value of values) {
    result.push(query.replace(`$${variableName}`, value))
  }
  return result
}

/** this is sloppy and only so we can use the typescript xpath api included */
export function parseWithVariable(query: string, variableName: string, ...values: string[]): XPathExpression[] {
  return withVariable(query, variableName, ...values).map(q => xpath.parse(q))
}
