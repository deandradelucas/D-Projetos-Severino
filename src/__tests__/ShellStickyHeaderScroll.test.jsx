import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, fireEvent, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
              <header className="ref-dashboard-header" />
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
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toggles the scrolled class when scroll exceeds threshold', async () => {
    const { container } = render(
      <MemoryRouter>
        <ShellFixture />
      </MemoryRouter>
    )

    const main = container.querySelector('main.ref-dashboard-main')
    const shell = container.querySelector('.dashboard-container.app-horizon-shell')
    expect(main).toBeTruthy()
    expect(shell).toBeTruthy()

    await act(async () => {
      vi.runAllTimers()
    })

    await act(async () => {
      shell.scrollTop = 20
      fireEvent.scroll(shell)
    })
    expect(main.classList.contains('ref-dashboard-main--scrolled')).toBe(true)

    await act(async () => {
      shell.scrollTop = 0
      fireEvent.scroll(shell)
    })
    expect(main.classList.contains('ref-dashboard-main--scrolled')).toBe(false)
  })
})
