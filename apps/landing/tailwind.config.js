module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme colors using CSS variables for easy switching
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        // Transparency utilities (10% to 95%)
        transparent: 'transparent',
        ...Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => {
            const percent = (i + 1) * 10;
            return [
              `opacity-${percent}`,
              `rgba(0,0,0,${percent / 100})`, // fallback, but use CSS vars in CSS
            ];
          })
        ),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        heading: ['Poppins', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};
