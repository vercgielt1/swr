import useSWR from 'swr'
import React from 'react'
import { createResponse } from '../../common-utils'

let value = 0
export function Page({ testKey }: { testKey: string }) {
  const { data } = useSWR(
    testKey,
    () => createResponse(value++, { delay: 500 }),
    {
      dedupingInterval: 0,
      focusThrottleInterval: 50
    }
  )
  console.log('data', data)
  return <div>data: {data}</div>
}
