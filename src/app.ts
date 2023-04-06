import {Rshell} from "./r-bridge/rshell";

console.log("Hello World");

const executor = new Rshell();

executor.sendCommand("print('Hello World')");