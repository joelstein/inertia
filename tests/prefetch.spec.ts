import { expect, Page, test } from '@playwright/test'
import { clickAndWaitForResponse, requests } from './support'

const isPrefetchPage = async (page: Page, id: number) => {
  await page.waitForURL(`prefetch/${id}`)
  await expect(page.getByText(`This is page ${id}`)).toBeVisible()
}

const isPrefetchSwrPage = async (page: Page, id: number) => {
  await page.waitForURL(`prefetch/swr/${id}`)
  await expect(page.getByText(`This is page ${id}`)).toBeVisible()
}

const hoverAndClick = async (page: Page, buttonText: string, id: number) => {
  await page.getByRole('link', { name: buttonText, exact: true }).hover()
  await page.waitForTimeout(75)
  await clickAndWaitForResponse(page, buttonText, `prefetch/swr/${id}`)
  await isPrefetchSwrPage(page, id)
}

test('will not prefetch current page', async ({ page }) => {
  // These two prefetch requests should be made on mount
  const prefetch2 = page.waitForResponse('prefetch/2')
  const prefetch4 = page.waitForResponse('prefetch/4')

  await page.goto('prefetch/1')

  // These two prefetch requests should be made on mount
  const request2 = await prefetch2
  const request4 = await prefetch4

  expect(request2.request().headers().purpose).toBe('prefetch')
  expect(request4.request().headers().purpose).toBe('prefetch')

  requests.listen(page)
  await page.getByRole('link', { name: 'On Hover (Default)' }).hover()
  await page.waitForTimeout(100)
  // This is the page we're already on, so it shouldn't make a request
  await expect(requests.requests.length).toBe(0)
})

test('removes single-use prefetch from cache when cacheFor is 0', async ({ page }) => {
  const prefetch5 = page.waitForResponse('prefetch/5')

  await page.goto('prefetch/1')
  await prefetch5

  requests.listen(page)
  await page.getByRole('link', { name: 'On Mount (Once)' }).click()
  await isPrefetchPage(page, 5)
  await expect(requests.requests.length).toBe(0)

  // Now that we've used it, it should be removed from the cache
  await page.getByRole('link', { name: 'On Mount (Once)' }).click()
  await expect(requests.requests.length).toBe(1)
})

test('can prefetch using link props', async ({ page }) => {
  // These two prefetch requests should be made on mount
  const prefetch2 = page.waitForResponse('prefetch/2')
  const prefetch4 = page.waitForResponse('prefetch/4')

  await page.goto('prefetch/1')

  // These two prefetch requests should be made on mount
  await prefetch2
  await prefetch4

  requests.listen(page)

  await page.getByRole('link', { name: 'On Mount', exact: true }).click()
  await isPrefetchPage(page, 2)
  await expect(requests.requests.length).toBe(0)

  await page.getByRole('link', { name: 'On Hover + Mount' }).click()
  await isPrefetchPage(page, 4)
  await expect(requests.requests.length).toBe(0)

  await page.getByRole('link', { name: 'On Click' }).hover()
  await page.mouse.down()
  await page.waitForResponse('prefetch/3')
  await expect(page).toHaveURL('prefetch/4')
  requests.listen(page)
  await page.mouse.up()
  await isPrefetchPage(page, 3)
  await expect(requests.requests.length).toBe(0)

  requests.listen(page)
  await page.getByRole('link', { name: 'On Hover (Default)' }).hover()
  await page.getByRole('link', { name: 'On Click' }).hover()
  // If they just do a quick hover, it shouldn't make the request
  await expect(requests.requests.length).toBe(0)

  await page.getByRole('link', { name: 'On Hover (Default)' }).hover()
  await page.waitForResponse('prefetch/1')
  await expect(page).toHaveURL('prefetch/3')

  requests.listen(page)
  await page.getByRole('link', { name: 'On Hover (Default)' }).click()
  await isPrefetchPage(page, 1)
  await expect(requests.requests.length).toBe(0)

  // Wait for the cache to timeout on the combo link
  await page.waitForTimeout(1200)

  await page.getByRole('link', { name: 'On Hover + Mount' }).hover()
  await page.waitForResponse('prefetch/4')
  await expect(page).toHaveURL('prefetch/1')

  requests.listen(page)
  await page.getByRole('link', { name: 'On Hover + Mount' }).click()
  await isPrefetchPage(page, 4)
  await expect(requests.requests.length).toBe(0)
})

test('can cache links with single cache value', async ({ page }) => {
  await page.goto('prefetch/swr/1')

  requests.listen(page)

  // Click back and forth a couple of times to ensure no requests go out
  await hoverAndClick(page, '1s Expired (Number)', 3)
  await expect(requests.requests.length).toBe(1)
  const lastLoaded1 = await page.locator('#last-loaded').textContent()

  await hoverAndClick(page, '1s Expired', 2)
  await isPrefetchSwrPage(page, 2)
  await expect(requests.requests.length).toBe(2)
  const lastLoaded2 = await page.locator('#last-loaded').textContent()

  requests.listen(page)

  await page.getByRole('link', { exact: true, name: '1s Expired (Number)' }).click()
  await isPrefetchSwrPage(page, 3)
  await expect(requests.requests.length).toBe(0)
  const lastLoaded1New = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded1).toBe(lastLoaded1New)

  await page.getByRole('link', { exact: true, name: '1s Expired' }).click()
  await isPrefetchSwrPage(page, 2)
  await expect(requests.requests.length).toBe(0)
  const lastLoaded2New = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded2).toBe(lastLoaded2New)

  // Wait for cache to expire
  await page.waitForTimeout(1200)

  requests.listenForFinished(page)

  await hoverAndClick(page, '1s Expired (Number)', 3)
  await expect(requests.finished.length).toBe(1)
  const lastLoaded1Fresh = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded1).not.toBe(lastLoaded1Fresh)

  await hoverAndClick(page, '1s Expired', 2)
  await expect(requests.finished.length).toBe(2)
  const lastLoaded2Fresh = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded2).not.toBe(lastLoaded2Fresh)
})

test.skip('can do SWR when the link cacheFor prop has two values', async ({ page }) => {
  await page.goto('prefetch/swr/1')

  requests.listen(page)

  await hoverAndClick(page, '1s Stale, 2s Expired (Number)', 5)
  await expect(requests.requests.length).toBe(1)
  const lastLoaded1 = await page.locator('#last-loaded').textContent()

  await hoverAndClick(page, '1s Stale, 2s Expired', 4)
  await expect(requests.requests.length).toBe(2)
  const lastLoaded2 = await page.locator('#last-loaded').textContent()

  requests.listen(page)

  // Click back and forth a couple of times to ensure no requests go out
  await page.getByRole('link', { exact: true, name: '1s Stale, 2s Expired (Number)' }).click()
  await isPrefetchSwrPage(page, 5)
  await expect(requests.requests.length).toBe(0)
  const lastLoaded1New = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded1).toBe(lastLoaded1New)

  await page.getByRole('link', { exact: true, name: '1s Stale, 2s Expired' }).click()
  await isPrefetchSwrPage(page, 4)
  await expect(requests.requests.length).toBe(0)
  const lastLoaded2New = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded2).toBe(lastLoaded2New)

  // Wait for stale time to pass
  await page.waitForTimeout(1200)

  requests.listenForFinished(page)

  const promiseFor5 = page.waitForResponse('prefetch/swr/5')
  await page.getByRole('link', { exact: true, name: '1s Stale, 2s Expired (Number)' }).hover()
  await page.waitForTimeout(75)
  await page.getByRole('link', { exact: true, name: '1s Stale, 2s Expired (Number)' }).click()
  await isPrefetchSwrPage(page, 5)
  const lastLoaded1Stale = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded1).toBe(lastLoaded1Stale)
  await promiseFor5

  //   await expect(requests.finished.length).toBe(1)
  await page.waitForTimeout(600)
  const lastLoaded1Fresh = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded1).not.toBe(lastLoaded1Fresh)

  const promiseFor4 = page.waitForResponse('prefetch/swr/4')
  await page.getByRole('link', { exact: true, name: '1s Stale, 2s Expired' }).click()
  await isPrefetchSwrPage(page, 4)
  const lastLoaded2Stale = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded2).toBe(lastLoaded2Stale)

  await promiseFor4
  //   await expect(requests.finished.length).toBe(2)
  await page.waitForTimeout(100)
  const lastLoaded2Fresh = await page.locator('#last-loaded').textContent()
  await expect(lastLoaded2).not.toBe(lastLoaded2Fresh)
})
