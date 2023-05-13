/**
 * Retrieve a string in the form of "YYYY-MM-DD-HH-MM-SS-MS" from a Date object.
 */
export function date2string(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDay()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${date.getMilliseconds()}`
}
