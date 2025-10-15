import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from '../App.tsx'
import { MemoryRouter } from 'react-router-dom'

it('renders without crashing', () => {
  const { container } = render(
    <MemoryRouter
      initialEntries={['/']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    > 
      <App />
    </MemoryRouter>
  )
  expect(container).toBeTruthy()
})
