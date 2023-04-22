// TODO: single letter type in the future
import { guard } from './assert'

export function startAndEndsWith (str: string, letter: string): boolean {
  guard(str.length !== 1, `startAndEndsWith: letter must be a single character  ${letter}`)
  guard(str.length >= 2, `startAndEndsWith: str can not be empty|one character to start and end with the same letter ${letter}`)

  return str[0] === letter && str[str.length - 1] === letter
}
