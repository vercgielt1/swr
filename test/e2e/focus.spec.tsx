/* eslint-disable testing-library/prefer-screen-queries */
import { test, expect } from '@playwright/experimental-ct-react'
import React, { Profiler } from 'react'
import { createKey, sleep } from '../common-utils'
import { Page } from './components/focus'
test.use({ viewport: { width: 500, height: 500 } })

test.describe('SWR focus', () => {
  test('basic focus', async ({ mount, page }) => {
    const key = createKey()
    let count = 0
    const component = await mount(
      <Profiler
        id={key}
        onRender={() => {
          count += 1
        }}
      >
        <Page testKey={key}></Page>
      </Profiler>
    )
    await expect(component).toHaveText('data:')
    await expect(component).toHaveText('data: 0')
    await page.$eval('html', async () => {
      const focus = new Event('focus')
      window.dispatchEvent(focus)
      return true
    })
    await expect(component).toHaveText('data: 1')
    await sleep(100)
    await page.$eval('html', async () => {
      const focus = new Event('focus')
      window.dispatchEvent(focus)
      return true
    })
    await expect(component).toHaveText('data: 2')
    expect(count).toEqual(4)
  })
})
