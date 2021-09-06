import { isFunction, isUndefined } from './helper'

// use WeakMap to store the object->key mapping
// so the objects can be garbage collected.
// WeakMap uses a hashtable under the hood, so the lookup
// complexity is almost O(1).
const table = new WeakMap<object, number>()

// counter of the key
let counter = 0

// A stable hash implementation that supports:
// - Fast and ensures unique hash properties
// - Handles unserializable values
// - Handles object key ordering
// - Generates short results
//
// This is not a serialization function, and the result is not guaranteed to be
// parsible.
export function stableHash(arg: any): string | undefined {
  // Arg isn't null or undefined: https://dorey.github.io/JavaScript-Equality-Table
  // Not using `typeof` here because `typeof new String('') == 'object'`.
  const constructor = arg != null && arg.constructor

  const type = typeof arg

  const isString = constructor == String
  const isDate = constructor == Date
  const isRegExp = constructor == RegExp
  const isSymbol = type == 'symbol'

  let result: any

  if (
    constructor &&
    (isFunction(arg) || type == 'object') &&
    !isDate &&
    !isRegExp
  ) {
    // It's an object, use WeakMap to store the id first.
    result = table.get(arg)
    if (!result) {
      result = ++counter + '~'
      table.set(arg, result)
    } else {
      // It's already hashed, directly return the result.
      return result
    }

    if (constructor == Array) {
      // Array.
      result = '$'
      for (const v of arg) {
        result += stableHash(v) + ','
      }
      table.set(arg, result)
    } else if (constructor == Object) {
      // Object, sort keys.
      result = '#'
      const keys = Object.keys(arg).sort()
      for (const k of keys) {
        if (!isUndefined(arg[k])) {
          result += k + ':' + stableHash(arg[k]) + ','
        }
      }
      table.set(arg, result)
    }
  } else {
    result = isSymbol
      ? arg.toString()
      : isString
      ? JSON.stringify(arg)
      : '' + arg
  }

  // if (isFunction(arg)) {
  //   // Function, class, use WeakMap because not serializable.
  //   result = table.get(arg)
  //   if (!result) {
  //     result = ++counter
  //     table.set(arg, result)
  //   }
  //   result += '~'
  // } else if (constructor == Array) {
  //   // Array.
  //   result = '$'
  //   for (const v of arg) {
  //     result += stableHash(v) + ','
  //   }
  // } else if (constructor == Object) {
  //   // Object, sort keys.
  //   result = '#'
  //   const keys = Object.keys(arg).sort()
  //   for (const k of keys) {
  //     if (!isUndefined(arg[k])) {
  //       result += k + ':' + stableHash(arg[k]) + ','
  //     }
  //   }
  // } else {
  //   // Other primitives.
  //   try {
  //     // Handles boolean, null, undefined, number, NaN, string, bigint, etc.
  //     result = constructor == String ? JSON.stringify(arg) : '' + arg
  //   } catch (err) {
  //     // For symbols, we have to use `toString`.
  //     result = arg.toString()
  //   }
  // }

  return result
}

// hashes an array of objects and returns a string
export function hash(args: any[]): string {
  if (!args.length) return ''
  return 'arg' + stableHash(args)
}
