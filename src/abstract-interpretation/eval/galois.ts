
/** for all a: A and b: B must hold: gen(a) <= b and a <= con(b) */
export interface GaloisConnection<A, B> {
  generalization: (a: A) => B;
  concretization: (b: B) => A;
}
