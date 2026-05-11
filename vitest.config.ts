import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    coverage: {
      provider: "v8",
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        'e2e/**',
        // Rich-text editor: requires ProseMirror/Tiptap DOM env not supported in jsdom
        '**/*NoteEditorClient*',
        // PDF renderer: uses @react-pdf/renderer which requires browser canvas, not jsdom
        '**/DocumentReport*',
        // Navigation shell — no business logic to cover
        '**/components/layout/Sidebar*',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
