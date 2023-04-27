/** use this to ensure that all cases are covered in case of a selection */

/* istanbul ignore next */
export function assertUnreachable (x: never): never {
  throw new Error(`Unexpected object: ${JSON.stringify(x)}`)
}

class GuardError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'GuardError'
  }
}

export function guard (x: boolean, message = 'Assertion failed'): asserts x {
  if (!x) {
    throw new GuardError(message)
  }
}
