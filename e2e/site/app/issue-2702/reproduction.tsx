'use client'
import useSWR from 'swr'
import { Suspense, use, useEffect, useState } from 'react'

const sleep = (time: number, data: string) =>
  new Promise<string>(resolve => {
    // console.log('sleep', time, data)
    setTimeout(() => resolve(data), time)
  })

//const a = (() => sleep(1000, 'a'))()
// const b = (() => sleep(2000, 'b'))()
const Bug = () => {
  console.log('start')
  useSWR('a', () => sleep(1000, 'a'), {
    suspense: true
  })
  console.log('a finished')
  useSWR('b', () => sleep(2000, 'b'), {
    suspense: true
  })
  console.log('b finished')
  /*const resulta = use(a)
  const resultb = use(b)*/
  useState(true)
  return null
}

const Comp = () => {
  const [loading, setLoading] = useState(true)

  // To prevent SSR
  useEffect(() => setLoading(false), [])

  if (loading) {
    return <span>Loading...</span>
  }
  return (
    <Suspense fallback={<div> fetching </div>}>
      <Bug />
    </Suspense>
  )
}

export default Comp
