// TODO: single letter type in the future
export function startAndEndsWith(str: string, letter: string): boolean {
  if (letter.length !== 1) {
    throw new Error(`startAndEndsWith: letter must be a single character ${letter}`)
  } else if (str.length < 2) {
    throw new Error(`startAndEndsWith: str can not be empty|one character to start and end with the same letter ${letter}`)
  }
  return str[0] === letter && str[str.length - 1] === letter
}
