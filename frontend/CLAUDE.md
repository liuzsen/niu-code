# Frontend Development Guidelines

## Vue3 + PrimeVue + Tailwind CSS

### Theme System

- **Prefer use PrimeVue semantic colors over than hardcoded colors**: `primary`, `surface`
- Use severity colors: `success`, `info`, `warn`, `danger`

### Styling Priority

1. PrimeVue component props (severity, size, variant)
2. PrimeVue CSS variables
3. Tailwind utilities (spacing, layout, typography)
4. Custom CSS (rare)
5. Never use inline style

### Development Standards

- Use Vue 3 Composition API with `<script lang='ts' setup>`
- Extract reusable logic into composables

## Workflow

- After completing code editing tasks, you must run `pnpm run check` to ensure code quality.
- Claude should **NEVER** test code functionality or start the development server.
