import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // ngrok 같은 터널 주소로 접속해도 개발 서버가 막지 않도록 허용한다(개발용 설정).
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    proxy: { '/api': 'http://127.0.0.1:8001' },
  },
})
