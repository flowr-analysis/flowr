// all examples are based on the R language def (Draft of 2023-03-15, 10.3.1)
import { type RNumberValue } from '../../../src/r-bridge/lang/values'

// maps a string to the expected R number parse value // TODO: test automatically against what R produces?
export const RNumberPool: Array<{ val: RNumberValue, str: string }> = [
  // the default block
  { str: '1', val: { num: 1, complexNumber: false, markedAsInt: false } },
  { str: '10', val: { num: 10, complexNumber: false, markedAsInt: false } },
  { str: '0.1', val: { num: 0.1, complexNumber: false, markedAsInt: false } },
  { str: '0.2', val: { num: 0.2, complexNumber: false, markedAsInt: false } },
  { str: '1e-7', val: { num: 1e-7, complexNumber: false, markedAsInt: false } },
  { str: '1.2e7', val: { num: 1.2e7, complexNumber: false, markedAsInt: false } },
  { str: '0xAF12', val: { num: 0xAF12, complexNumber: false, markedAsInt: false } },
  // floating hex notation
  { str: '0x0p0', val: { num: 0, complexNumber: false, markedAsInt: false } },
  { str: '0x1.1p1', val: { num: (1 * 1 + 1 / 16) * (2 ** 1), complexNumber: false, markedAsInt: false } },
  { str: '0x1.1P1', val: { num: (1 * 1 + 1 / 16) * (2 ** 1), complexNumber: false, markedAsInt: false } },
  { str: '0xAF.FEp42', val: { num: (10 * 16 + 15 + 15 / 16 + 14 / (16 ** 2)) * (2 ** 42), complexNumber: false, markedAsInt: false } },
  { str: '0x.1p42', val: { num: (1 / 16) * (2 ** 42), complexNumber: false, markedAsInt: false } },
  { str: '0x.p10', val: { num: 0, complexNumber: false, markedAsInt: false } },
  { str: '0x.1p-5', val: { num: (1 / 16) * (2 ** -5), complexNumber: false, markedAsInt: false } },
  { str: '0x.p-5', val: { num: 0, complexNumber: false, markedAsInt: false } },
  // the explicit integer block
  { str: '1L', val: { num: 1, complexNumber: false, markedAsInt: true } },
  { str: '0x10L', val: { num: 16, complexNumber: false, markedAsInt: true } },
  { str: '1000000L', val: { num: 1000000, complexNumber: false, markedAsInt: true } },
  { str: '1e6L', val: { num: 1000000, complexNumber: false, markedAsInt: true } },
  // TODO: deal with warning messages issued?
  { str: '1.L', val: { num: 1, complexNumber: false, markedAsInt: true } },
  { str: '1.1L', val: { num: 1.1, complexNumber: false, markedAsInt: true } },
  { str: '1e-3L', val: { num: 0.001, complexNumber: false, markedAsInt: true } },
  // the imaginary block
  { str: '2i', val: { num: 2, complexNumber: true, markedAsInt: false } },
  { str: '4.1i', val: { num: 4.1, complexNumber: true, markedAsInt: false } },
  { str: '1e-2i', val: { num: 0.01, complexNumber: true, markedAsInt: false } }
]
