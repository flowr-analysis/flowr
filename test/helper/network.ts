// based on https://stackoverflow.com/a/63756303
import * as dns from "dns/promises"

export const hasNetworkConnection = async(): Promise<boolean> =>
  (await dns.resolve("google.com").catch(() => {
    /* do nothing */
  })) !== null
/** Automatically skip a suite if no internet connection is available */
export const suiteRequiresNetworkConnection = (): void => {
  before(async function() {
    if (!await hasNetworkConnection()) {
      console.warn('Skipping suite because no internet connection is available')
      this.skip()
    }
  })
}

/** Automatically skip a test if no internet connection is available */
export const testRequiresNetworkConnection = async(test: Mocha.Context): Promise<void> => {
  if (!await hasNetworkConnection()) {
    console.warn('Skipping test because no internet connection is available')
    test.skip()
  }
}
