/* global globalThis, self */
import freeGlobal from './freeGlobal'

/** Detect free variable `globalThis` */
const freeGlobalThis =
  typeof globalThis === 'object' &&
  globalThis !== null &&
  globalThis.Object === Object &&
  globalThis

/** Detect free variable `self`. */
// eslint-disable-next-line no-restricted-globals
const freeSelf = typeof self === 'object' && self !== null && self.Object === Object && self

/** Used as a reference to the global object. */
// eslint-disable-next-line no-new-func
const root = freeGlobalThis || freeGlobal || freeSelf || Function('return this')()

export default root
