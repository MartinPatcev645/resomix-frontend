import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import App from '../App.tsx'
import { MemoryRouter } from 'react-router-dom'

/**
 * Auth init is stubbed as ALREADY FINISHED on purpose.
 *
 * Without this, App returns its boot loader and the test never renders WebLayout — which is how a
 * crash inside the shell ("AudioProvider is missing in the tree") once took the app to a blank page
 * while this very test stayed green. Getting past the boot gate is what makes this a smoke test of
 * the app rather than of the spinner.
 */
vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>()
  return {
    ...actual,
    useAuthInit: () => ({ isInitialized: true, isLoading: false }),
    useSilktide: () => ({ loaded: false }),
    useTelemetry: () => undefined,
  }
})

function renderApp(path = '/') {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>
  )
}

it('renders without crashing', () => {
  const { container } = renderApp()
  expect(container).toBeTruthy()
})

it('mounts the persistent shell, not just the boot loader', async () => {
  renderApp('/sonic-discovery')

  // The header only exists inside WebLayout, so finding it proves the shell rendered.
  await waitFor(() => {
    expect(document.querySelector('.nav-site')).toBeTruthy()
  })
  expect(screen.queryByText(/AudioProvider is missing/i)).not.toBeInTheDocument()
})
