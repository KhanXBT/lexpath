/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "var(--void-bg)",
                foreground: "var(--text-primary)",
                primary: {
                    DEFAULT: "var(--holo-teal)",
                    foreground: "var(--void-bg)",
                },
                secondary: {
                    DEFAULT: "var(--holo-blue)",
                    foreground: "var(--text-primary)",
                },
                destructive: {
                    DEFAULT: "var(--alert-red)",
                    foreground: "white",
                },
                muted: {
                    DEFAULT: "var(--panel-bg)",
                    foreground: "var(--text-secondary)",
                },
                accent: {
                    DEFAULT: "rgba(0, 243, 255, 0.1)",
                    foreground: "var(--holo-teal)",
                },
            },
        },
    },
    // CRITICAL: Disable preflight to protect "Legal Jarvis" App.css styles
    corePlugins: {
        preflight: false,
    },
    plugins: [],
}
