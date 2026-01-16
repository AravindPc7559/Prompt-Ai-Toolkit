# Prompt AI Toolkit - Landing Page

A modern, animated landing page for the Prompt AI Toolkit browser extension.

## Features

- ✨ Modern, responsive design
- 🎨 Smooth animations and transitions
- 📱 Mobile-friendly layout
- 🚀 Performance optimized
- 🎯 Interactive elements with hover effects
- 📊 Animated statistics counter
- 🌈 Gradient backgrounds and effects

## Files Structure

```
landing page/
├── index.html      # Main HTML structure
├── styles.css      # All styling and animations
├── script.js       # Interactive features and animations
└── README.md       # This file
```

## How to Use

1. **Open the landing page:**
   - Simply open `index.html` in your web browser
   - Or serve it using a local server for best experience

2. **Using a local server (recommended):**
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
   
   Then open `http://localhost:8000` in your browser

## Sections

1. **Hero Section** - Eye-catching introduction with animated gradient background
2. **Features** - Showcase of all app features with hover effects
3. **How It Works** - Step-by-step guide with animations
4. **Pricing** - Three pricing tiers with highlighted featured plan
5. **CTA Section** - Call-to-action with gradient background
6. **Footer** - Links and company information

## Customization

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* ... other variables */
}
```

### Content
- Edit text content directly in `index.html`
- Modify section structure as needed
- Add or remove features in the features grid

### Animations
- Animation timings can be adjusted in `styles.css`
- Scroll animations are controlled in `script.js`
- Add new animations by following the existing patterns

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Optimized images and assets
- Throttled scroll events
- Efficient animation rendering
- Lazy loading ready

## License

MIT
