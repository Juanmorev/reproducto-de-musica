export class Node<T> {
  constructor(public value: T, public prev: Node<T> | null = null, public next: Node<T> | null = null) {}
}

export class DoublyLinkedList<T> implements Iterable<T> {
  head: Node<T> | null = null;
  tail: Node<T> | null = null;
  current: Node<T> | null = null; // "play head" pointer
  /** When true, next() on the last node wraps to the head and prev() on the head wraps to the tail. */
  circular = false;
  private count = 0;

  get size(): number { return this.count; }

  prepend(value: T): Node<T> { return this.link(new Node(value), 0); }
  append(value: T): Node<T> { return this.link(new Node(value), this.count); }
  insertAt(index: number, value: T): Node<T> {
    if (index < 0 || index > this.count) throw new RangeError("Index out of range");
    return this.link(new Node(value), index);
  }

  removeAt(index: number): T | null {
    const node = this.getNode(index);
    return node ? this.removeNode(node) : null;
  }
  removeById(predicate: (v: T) => boolean): T | null {
    const i = this.indexOf(predicate);
    return i < 0 ? null : this.removeAt(i);
  }
  /** Unlinks a node; if it was current, the pointer moves to its neighbour. */
  removeNode(node: Node<T>): T {
    if (this.current === node) this.current = node.next ?? node.prev;
    this.unlink(node);
    return node.value;
  }

  /** Moves a node to another index without recreating it (keeps the current pointer valid). */
  move(from: number, to: number): void {
    const node = this.getNode(from);
    if (!node || to < 0 || to >= this.count || from === to) return;
    this.unlink(node);
    this.link(node, to);
  }

  next(): Node<T> | null {
    if (!this.current) { this.current = this.head; return this.current; }
    if (!this.current.next) { if (!this.circular) return null; return (this.current = this.head); }
    return (this.current = this.current.next);
  }
  prev(): Node<T> | null {
    if (!this.current) { this.current = this.head; return this.current; }
    if (!this.current.prev) { if (!this.circular) return null; return (this.current = this.tail); }
    return (this.current = this.current.prev);
  }

  getNode(index: number): Node<T> | null {
    if (index < 0 || index >= this.count) return null;
    let node: Node<T>;
    if (index < this.count / 2) { node = this.head!; for (let i = 0; i < index; i++) node = node.next!; }
    else { node = this.tail!; for (let i = this.count - 1; i > index; i--) node = node.prev!; }
    return node;
  }
  find(predicate: (v: T) => boolean): Node<T> | null {
    for (let n = this.head; n; n = n.next) if (predicate(n.value)) return n;
    return null;
  }
  indexOf(predicate: (v: T) => boolean): number {
    let i = 0;
    for (let n = this.head; n; n = n.next, i++) if (predicate(n.value)) return i;
    return -1;
  }
  indexOfNode(node: Node<T>): number {
    let i = 0;
    for (let n = this.head; n; n = n.next, i++) if (n === node) return i;
    return -1;
  }
  toArray(): T[] { return [...this]; }
  *[Symbol.iterator](): Iterator<T> { for (let n = this.head; n; n = n.next) yield n.value; }

  private link(node: Node<T>, index: number): Node<T> {
    if (this.count === 0) { this.head = this.tail = node; }
    else if (index === 0) { node.next = this.head; this.head!.prev = node; this.head = node; }
    else if (index >= this.count) { node.prev = this.tail; this.tail!.next = node; this.tail = node; }
    else {
      const at = this.getNode(index)!;
      node.prev = at.prev; node.next = at;
      at.prev!.next = node; at.prev = node;
    }
    this.count++;
    return node;
  }
  private unlink(node: Node<T>): void {
    if (node.prev) node.prev.next = node.next; else this.head = node.next;
    if (node.next) node.next.prev = node.prev; else this.tail = node.prev;
    node.prev = node.next = null;
    this.count--;
  }
}
