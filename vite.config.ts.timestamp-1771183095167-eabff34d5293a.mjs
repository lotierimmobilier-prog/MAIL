// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openai.com; frame-ancestors 'none';",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgc2VydmVyOiB7XG4gICAgaGVhZGVyczoge1xuICAgICAgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JzogXCJkZWZhdWx0LXNyYyAnc2VsZic7IHNjcmlwdC1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJyAndW5zYWZlLWV2YWwnOyBzdHlsZS1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJzsgaW1nLXNyYyAnc2VsZicgZGF0YTogaHR0cHM6OyBmb250LXNyYyAnc2VsZicgZGF0YTo7IGNvbm5lY3Qtc3JjICdzZWxmJyBodHRwczovLyouc3VwYWJhc2UuY28gaHR0cHM6Ly9hcGkub3BlbmFpLmNvbTsgZnJhbWUtYW5jZXN0b3JzICdub25lJztcIixcbiAgICAgICdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJzogJ25vc25pZmYnLFxuICAgICAgJ1JlZmVycmVyLVBvbGljeSc6ICdzdHJpY3Qtb3JpZ2luLXdoZW4tY3Jvc3Mtb3JpZ2luJ1xuICAgIH1cbiAgfVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUVsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsUUFBUTtBQUFBLElBQ04sU0FBUztBQUFBLE1BQ1AsMkJBQTJCO0FBQUEsTUFDM0IsMEJBQTBCO0FBQUEsTUFDMUIsbUJBQW1CO0FBQUEsSUFDckI7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
