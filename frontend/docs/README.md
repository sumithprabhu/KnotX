# KnotX Documentation

This directory contains the Docusaurus documentation site for KnotX.

## Development

To run the documentation site in development mode:

```bash
npm start
```

This will start Docusaurus on http://localhost:3001

## Building

To build the documentation for production:

```bash
npm run build
```

The built files will be in the `build/` directory.

## Integration with Next.js

In development, Next.js proxies `/docs/*` requests to Docusaurus running on port 3001.

For production, you'll need to:
1. Build Docusaurus: `npm run build`
2. Copy the build output to Next.js public directory or configure static file serving


