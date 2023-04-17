/** use this to ensure that all cases are covered in case of a selection */
/* istanbul ignore next */
export function assertUnreachable(x: never): never {
  throw new Error(`Unexpected object: ${JSON.stringify(x)}`)
}
