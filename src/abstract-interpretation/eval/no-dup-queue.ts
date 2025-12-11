
type NoDupQueueElement<T> = {
  next: NoDupQueueElement<T> | undefined
  value: T
}

export class NoDupQueue<T> {
  private front?: NoDupQueueElement<T>
  private back?: NoDupQueueElement<T>
  private contains = new Set<T>()

  constructor(...initialValues: T[]) {
    this.push(...initialValues)
  }

  private pushSingle(value: T) {
    if (this.contains.has(value)) return;
    this.contains.add(value)

    const element = {
      next: undefined,
      value,
    }

    if (this.back) this.back = this.back.next = element
    else this.front = this.back = element
  }

  push(...values: T[]) {
    for (const value of values) this.pushSingle(value)
  }

  pop(): T | undefined {
    if (this.front) {
      const value = this.front.value
      this.front = this.front.next
      if (this.front === undefined) this.back = undefined
      this.contains.delete(value)
      return value
    }
  }

  isEmpty() {
    return !this.front
  }
}
