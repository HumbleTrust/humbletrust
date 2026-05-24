import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    // Required by @solana/web3.js
    'process.env': {},
    global: 'globalThis',
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  optimizeDeps: {
    include: ['@solana/web3.js', '@coral-xyz/anchor'],
  },
})
