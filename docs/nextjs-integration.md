# Next.js Integration

The example app in [`apps/example-next`](../apps/example-next) is the reference implementation.

## Main Files

- consumer shell: [`apps/example-next/components/analytics-shell.tsx`](../apps/example-next/components/analytics-shell.tsx)
- layout wiring: [`apps/example-next/app/layout.tsx`](../apps/example-next/app/layout.tsx)
- Meta route example: [`apps/example-next/app/api/facebook/track/route.ts`](../apps/example-next/app/api/facebook/track/route.ts)
- GA4 route example: [`apps/example-next/app/api/ga4/track/route.ts`](../apps/example-next/app/api/ga4/track/route.ts)

## Integration Shape

1. Read environment config on the server with `createEnvConfig(process.env)`.
2. In a client shell, create one consent engine and one analytics manager.
3. Register only the providers that are configured.
4. Wrap the app with `ConsentProvider` and `ConsentControllerProvider`.
5. Render `AnalyticsManager` and `AutoTracking`.
6. Keep server tracking routes app-local and build them from the exported server helpers.

## Minimal React Wiring

```tsx
<ConsentProvider engine={consentEngine}>
  <ConsentControllerProvider>
    <AnalyticsManager manager={manager} lazy={{ mode: 'idle', timeoutMs: 3000 }} />
    <AutoTracking manager={manager} />
    {children}
  </ConsentControllerProvider>
</ConsentProvider>
```

## Layout Concerns

- load the Shopify consent tracking script if you use Shopify Customer Privacy
- render optional Meta noscript markup in the layout
- keep page content inside the consent/provider tree so the UI and runtime share the same state

## Lazy Boot

Supported boot modes:

- `immediate`
- `idle`
- `manual`

The example app uses `idle`. That means provider initialization can lag a couple of seconds behind first paint.
