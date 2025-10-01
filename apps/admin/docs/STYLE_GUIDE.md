# Resomix Admin Dashboard - Style Guide

> Design system and theming guidelines for the admin dashboard

---

## 🎨 Color System

### Theme Philosophy
- **Light Mode**: Clean, professional, soft whites and grays
- **Dark Mode**: Comfortable slate/blue-tinted grays, easy on the eyes
- **Accent**: Soft indigo/purple primary color for both themes

### CSS Variables

All colors are defined as CSS custom properties that automatically adapt to light/dark mode:

#### Primary Colors
```css
var(--color-primary)        /* Main brand color: Indigo */
var(--color-primary-hover)  /* Hover state */
var(--color-primary-light)  /* Lighter variant */
var(--color-primary-dark)   /* Darker variant */
```

#### Semantic Colors
```css
var(--color-accent)         /* Pink accent */
var(--color-success)        /* Green - success states */
var(--color-warning)        /* Amber - warning states */
var(--color-error)          /* Red - error states */
var(--color-info)           /* Blue - info states */
```

#### Background Colors
```css
var(--color-background)           /* Main page background */
var(--color-background-secondary) /* Secondary sections */
var(--color-background-tertiary)  /* Tertiary sections */
var(--color-surface)              /* Card/panel backgrounds */
var(--color-surface-hover)        /* Surface hover state */
```

#### Border Colors
```css
var(--color-border)       /* Default borders */
var(--color-border-light) /* Subtle borders */
var(--color-border-dark)  /* Emphasized borders */
```

#### Text Colors
```css
var(--color-text-primary)   /* Headings, primary text */
var(--color-text-secondary) /* Body text, secondary info */
var(--color-text-tertiary)  /* Muted text, placeholders */
var(--color-text-inverse)   /* Text on dark backgrounds */
```

#### Opacity Levels
```css
var(--opacity-5)  /* 5% opacity overlay */
var(--opacity-10) /* 10% opacity overlay */
var(--opacity-20) /* 20% opacity overlay */
/* ... up to var(--opacity-90) */
```

---

## 🛠️ Usage Patterns

### Using Theme Variables

#### In Tailwind Classes
Use the custom utility classes:
```tsx
<div className="bg-surface text-primary border-default">
  <h1 className="text-primary">Heading</h1>
  <p className="text-secondary">Body text</p>
</div>
```

#### In Inline Styles
For dynamic or complex styling:
```tsx
<div style={{ backgroundColor: 'var(--color-primary)' }}>
  Content
</div>
```

#### Combined Approach
```tsx
<button 
  className="px-4 py-2 rounded-lg transition-colors"
  style={{ 
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-text-inverse)'
  }}
>
  Button
</button>
```

---

## 🌓 Theme Toggle

### Implementation
The theme is managed by `useTheme()` hook:
```tsx
import { useTheme } from '@/hooks/useTheme'

function MyComponent() {
  const { theme, toggleTheme, setTheme } = useTheme()
  
  return (
    <button onClick={toggleTheme}>
      Toggle to {theme === 'light' ? 'dark' : 'light'} mode
    </button>
  )
}
```

### Features
- ✅ Persists to `localStorage` as `admin-theme`
- ✅ Respects system preference on first visit
- ✅ Smooth transitions (300ms)
- ✅ Accessible with `aria-label`

---

## 📐 Component Patterns

### Cards/Panels
```tsx
<div className="bg-surface rounded-lg shadow p-6 border border-default transition-colors">
  <h2 className="text-xl font-bold text-primary mb-4">Title</h2>
  <p className="text-secondary">Content</p>
</div>
```

### Buttons

#### Primary Button
```tsx
<button 
  className="px-4 py-2 rounded-lg font-medium transition-colors"
  style={{ 
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-text-inverse)'
  }}
>
  Primary Action
</button>
```

#### Secondary Button
```tsx
<button className="px-4 py-2 rounded-lg border border-default text-primary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
  Secondary Action
</button>
```

### Navigation Items
```tsx
<NavLink
  to="/path"
  className={({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive
        ? 'font-medium'
        : 'text-secondary hover:bg-gray-100 dark:hover:bg-gray-800'
    }`
  }
  style={({ isActive }) => 
    isActive ? {
      backgroundColor: 'var(--opacity-10)',
      color: 'var(--color-primary)'
    } : undefined
  }
>
  Link Text
</NavLink>
```

---

## 🎯 Best Practices

### DO ✅
- Use CSS variables for all colors
- Add `transition-colors` for smooth theme switching
- Use semantic color names (primary, secondary, etc.)
- Add `dark:` variants for hover states
- Test components in both light and dark modes
- Use consistent spacing (px-4, py-3, gap-2, etc.)

### DON'T ❌
- Hard-code hex colors (use variables instead)
- Use Tailwind's built-in color classes (gray-900, blue-500, etc.)
- Forget transition classes when using theme variables
- Skip accessibility attributes (aria-label, etc.)
- Mix inline styles with Tailwind classes excessively

---

## 📊 Color Reference

### Light Mode Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--color-primary` | `#6366f1` | Primary actions, links |
| `--color-background` | `#ffffff` | Main background |
| `--color-surface` | `#ffffff` | Cards, panels |
| `--color-text-primary` | `#111827` | Headings |
| `--color-border` | `#e5e7eb` | Borders |

### Dark Mode Colors
| Variable | Value | Usage |
|----------|-------|-------|
| `--color-primary` | `#818cf8` | Primary actions, links |
| `--color-background` | `#0f172a` | Main background |
| `--color-surface` | `#1e293b` | Cards, panels |
| `--color-text-primary` | `#f1f5f9` | Headings |
| `--color-border` | `#334155` | Borders |

---

## 🚀 Adding New Components

When creating new components:

1. Start with the component structure
2. Apply theme-aware classes (`bg-surface`, `text-primary`)
3. Add hover states with both light and dark variants
4. Include transition classes for smooth interactions
5. Test in both themes
6. Document any custom patterns here

### Example Template
```tsx
function NewComponent() {
  return (
    <div className="bg-surface border border-default rounded-lg p-4 transition-colors">
      <h3 className="text-lg font-semibold text-primary mb-2">Title</h3>
      <p className="text-secondary">Description</p>
      <button 
        className="mt-4 px-4 py-2 rounded-lg transition-colors hover:opacity-90"
        style={{ 
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-text-inverse)'
        }}
      >
        Action
      </button>
    </div>
  )
}
```

---

## 📝 Notes

- All transitions use `300ms ease-in-out`
- Border radius: `rounded-lg` (8px) for most elements
- Shadow: `shadow` or `shadow-md` for elevation
- Spacing: Use Tailwind's scale (4, 6, 8, 12, 16, etc.)
- Icons: Use SVGs with `currentColor` for proper theming

---

**Last Updated**: October 01, 2025 