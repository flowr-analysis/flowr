import {assert} from "chai";
import {isObjectOrArray} from "../src/util/objects";

describe ("Objects", () => {
   describe("isObjectOrArray", () => {
       const positive = (a: any, msg: string) => assert.isTrue(isObjectOrArray(a), `must hold for ${msg}`);
       const negative = (a: any, msg: string) => assert.isFalse(isObjectOrArray(a), `${msg} is not considered an object`);

       it("should return true for all kinds of objects", () => {
           positive({}, "empty object");
           positive({ a: "x", b: 0}, "non-empty object");
       });
       it("should return true for all kinds of arrays", () => {
         positive([], "empty array");
         positive([1, 2, 3], "non-empty array");
       });

       it("should return false for null", () => {
           negative(null, "null");
       });
       it("should return false for strings, numbers, and others ", () => {
           negative(true, "a boolean");
           negative("hello", "a string");
           negative(42, "a number");
       });
   });
});