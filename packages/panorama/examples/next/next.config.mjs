import { fileURLToPath } from 'node:url'
export default {
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  async rewrites() { return [{ source:'/api/:path*', destination:'http://127.0.0.1:5196/api/:path*' },{ source:'/demo-media/:path*',destination:'http://127.0.0.1:5196/demo-media/:path*' }] }
}
