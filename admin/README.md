# Nevermore Admin App

Admin panel for the Nevermore mobile application built with React, Vite, TypeScript, and Tailwind CSS.

## Features

- ⚡️ **Vite** - Lightning fast development and build
- ⚛️ **React 19** - Latest React with modern features
- 🎨 **Tailwind CSS** - Utility-first CSS framework
- 🗂️ **React Router** - Client-side routing
- 🐻 **Zustand** - Lightweight state management
- 📦 **TypeScript** - Type-safe development
- 🎯 **ESLint** - Code quality and consistency

## Project Structure

```
src/
  ├── components/        # Reusable UI components
  │   ├── Layout.tsx     # Main layout with sidebar/header
  │   └── Sidebar.tsx    # Navigation sidebar
  ├── pages/            # Route pages
  │   ├── Dashboard.tsx
  │   └── NotFound.tsx
  ├── store/            # Zustand stores
  │   └── index.ts      # Store setup
  ├── routes/           # Route configuration
  │   └── index.tsx
  ├── types/            # TypeScript types
  │   └── index.ts
  ├── App.tsx
  └── main.tsx
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) in your browser

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Development

The admin panel features a modern, responsive layout with:
- Collapsible sidebar navigation
- Dashboard with key metrics
- Ready-to-expand route structure
- Tailwind CSS for styling
- Zustand for state management

## Tech Stack

- **React** ^19.1.1
- **Vite** ^7.1.7
- **TypeScript** ~5.9.3
- **Tailwind CSS** ^4.1.16
- **React Router** ^7.9.5
- **Zustand** ^5.0.8

## License

Private project for Nevermore application.
