# raindrop.ai Astro Rules

## raindrop.ai Integration

raindrop.ai is already integrated into this Astro project. The configuration includes:

- raindrop.ai initialization in `src/components/raindrop.astro`
- Layout setup in `src/layouts/raindropLayout.astro`
- Environment variables for API key and host

## Key Guidelines

### Component Structure
- raindrop.ai component uses `is:inline` directive to prevent Astro from processing the script
- Layout wraps raindrop.ai component in the `<head>` section
- Pages use raindropLayout to ensure raindrop.ai loads on all pages

### Environment Variables
- Use `PUBLIC_` prefix for client-side environment variables in Astro
- `PUBLIC_RAINDROP_KEY` - Your raindrop.ai project API key
- `PUBLIC_RAINDROP_HOST` - Your raindrop.ai instance URL

### Best Practices
- Always use `raindrop.identify()` when users sign in
- Use `raindrop.capture()` for custom events
- Feature flags can be accessed with `raindrop.isFeatureEnabled()`
- Keep the raindrop.ai script in the head section for accurate tracking

### File Structure
```
src/
├── components/
│   └── raindrop.astro          # raindrop.ai initialization
├── layouts/
│   └── raindropLayout.astro    # Layout with raindrop.ai
└── pages/
    └── *.astro                # Your pages using raindropLayout
```

### Common Patterns
- Wrap pages with raindropLayout for analytics
- Use raindrop.ai's autocapture for basic interaction tracking
- Implement custom events for business-specific actions
- Use feature flags for A/B testing and gradual rollouts