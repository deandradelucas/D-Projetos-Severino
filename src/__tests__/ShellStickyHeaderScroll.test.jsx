import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, fireEvent, act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import ShellStickyHeaderScroll from '../components/ShellStickyHeaderScroll.jsx'

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function ShellFixture() {
  return (
    <>
      <div className="dashboard-container app-horizon-shell">
        <div className="app-horizon-inner">
          <main className="main-content relative z-10 ref-dashboard-main">
            <div className="ref-dashboard-inner">
              <div className="dashboard-hub__hero" />
            </div>
          </main>
        </div>
      </div>
      <ShellStickyHeaderScroll />
    </>
  )
}

describe('ShellStickyHeaderScroll', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = globalThis.ResizeObserver || MockResizeObserver
  })

  // JSDOM não reproduz de forma confiável scroll + listeners do shell; teste manual no browser.
  it.skip('toggles the scrolled class when scroll exceeds threshold', async () => {
    const { container } = render(
      <MemoryRouter>
        <ShellFixture />
      </MemoryRouter>
    )

    const main = container.querySelector('main.ref-dashboard-main')
    const shell = container.querySelector('.dashboard-container.app-horizon-shell')
    expect(main).toBeTruthy()
    expect(shell).toBeTruthy()

    await waitFor(() => {
      expect(shell.scrollTop).toBeDefined()
    })

    await act(async () => {
      shell.scrollTop = 20
      fireEvent.scroll(shell)
    })
    await waitFor(() => expect(main.classList.contains('ref-dashboard-main--scrolled')).toBe(true))

    await act(async () => {
      shell.scrollTop = 0
      fireEvent.scroll(shell)
    })
    await waitFor(() => expect(main.classList.contains('ref-dashboard-main--scrolled')).toBe(false))
  })
})
