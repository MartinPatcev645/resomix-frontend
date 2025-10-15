import '@testing-library/jest-dom'
import { server } from './server.ts'
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
