# 4tie Frontend Application

Vanilla JavaScript frontend application for 4tie dashboard.

## Folder Structure

```
40/
├── src/
│   ├── components/       # Shared reusable UI components
│   ├── layouts/         # Shared layout components (header, footer, etc.)
│   ├── hooks/           # Shared custom hooks (vanilla JS patterns)
│   ├── utils/           # Shared utility functions and helpers
│   ├── services/        # Shared API services and data fetching
│   ├── styles/          # Shared CSS/styling files
│   ├── assets/          # Shared images, fonts, icons
│   ├── pages/           # Page-specific folders
│   │   ├── dashboard/   # Dashboard page
│   │   │   ├── layout/  # Dashboard-specific layout
│   │   │   └── components/ # Dashboard-specific components
│   │   ├── autoquant/   # AutoQuant page
│   │   │   ├── layout/  # AutoQuant-specific layout
│   │   │   └── components/ # AutoQuant-specific components
│   │   └── settings/    # Settings page
│   │       ├── layout/  # Settings-specific layout
│   │       └── components/ # Settings-specific components
│   └── index.js         # Entry point
├── public/              # Static files
├── package.json         # Project metadata
└── README.md            # Documentation
```

## Technology Stack

- Vanilla JavaScript (ES6+ modules)
- CSS for styling
- Vite for development server and build tool

## Getting Started

```bash
npm install
npm run dev
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
