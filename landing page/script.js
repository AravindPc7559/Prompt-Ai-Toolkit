// ============================================
// Smooth Scroll & Navigation
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offsetTop = target.offsetTop - 80;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });

  // Navbar scroll effect
  const navbar = document.querySelector('.navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
  });

  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      mobileMenuToggle.classList.toggle('active');
    });
  }

  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
      navLinks.classList.remove('active');
      mobileMenuToggle.classList.remove('active');
    }
  });
});

// ============================================
// Animated Counter
// ============================================

function animateCounter(element, target, duration = 2000) {
  let start = 0;
  const increment = target / (duration / 16);
  const timer = setInterval(() => {
    start += increment;
    if (start >= target) {
      element.textContent = formatNumber(target);
      clearInterval(timer);
    } else {
      element.textContent = formatNumber(Math.floor(start));
    }
  }, 16);
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return Math.floor(num).toString();
}

// ============================================
// Intersection Observer for Animations
// ============================================

const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('aos-animate');
      
      // Animate counters when stats section is visible
      if (entry.target.classList.contains('stat-number')) {
        const target = parseInt(entry.target.getAttribute('data-target'));
        if (target && !entry.target.classList.contains('animated')) {
          entry.target.classList.add('animated');
          animateCounter(entry.target, target);
        }
      }
    }
  });
}, observerOptions);

// Observe all elements with data-aos attribute
document.addEventListener('DOMContentLoaded', () => {
  const animatedElements = document.querySelectorAll('[data-aos]');
  animatedElements.forEach(el => observer.observe(el));

  // Observe stat numbers
  const statNumbers = document.querySelectorAll('.stat-number');
  statNumbers.forEach(el => observer.observe(el));
});

// ============================================
// Parallax Effect for Hero Background
// ============================================

window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset;
  const orbs = document.querySelectorAll('.gradient-orb');
  
  orbs.forEach((orb, index) => {
    const speed = 0.5 + (index * 0.1);
    const yPos = -(scrolled * speed);
    orb.style.transform = `translateY(${yPos}px)`;
  });
});

// ============================================
// Floating Card Animation
// ============================================

function addFloatingAnimation() {
  const card = document.querySelector('.floating-card');
  if (card) {
    let mouseX = 0;
    let mouseY = 0;
    let cardX = 0;
    let cardY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function animate() {
      const dx = (mouseX - window.innerWidth / 2) * 0.01;
      const dy = (mouseY - window.innerHeight / 2) * 0.01;
      
      cardX += (dx - cardX) * 0.1;
      cardY += (dy - cardY) * 0.1;
      
      card.style.transform = `translate(${cardX}px, ${cardY}px) rotate(${cardX * 0.1}deg)`;
      
      requestAnimationFrame(animate);
    }
    
    animate();
  }
}

// Initialize floating animation
document.addEventListener('DOMContentLoaded', addFloatingAnimation);

// ============================================
// Button Hover Effects
// ============================================

document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('mouseenter', function() {
    this.style.transform = 'translateY(-2px)';
  });
  
  btn.addEventListener('mouseleave', function() {
    this.style.transform = 'translateY(0)';
  });
});

// ============================================
// Feature Cards Tilt Effect
// ============================================

document.querySelectorAll('.feature-card').forEach(card => {
  card.addEventListener('mousemove', function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;
    
    this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
  });
  
  card.addEventListener('mouseleave', function() {
    this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
  });
});

// ============================================
// Pricing Card Hover Effect
// ============================================

document.querySelectorAll('.pricing-card').forEach(card => {
  card.addEventListener('mouseenter', function() {
    if (!this.classList.contains('featured')) {
      this.style.borderColor = '#667eea';
    }
  });
  
  card.addEventListener('mouseleave', function() {
    if (!this.classList.contains('featured')) {
      this.style.borderColor = '';
    }
  });
});

// ============================================
// Gradient Text Animation
// ============================================

function animateGradient() {
  const gradientTexts = document.querySelectorAll('.gradient-text');
  
  gradientTexts.forEach(text => {
    let hue = 0;
    setInterval(() => {
      hue = (hue + 1) % 360;
      text.style.filter = `hue-rotate(${hue}deg)`;
    }, 50);
  });
}

// ============================================
// Cursor Trail Effect (Optional)
// ============================================

function createCursorTrail() {
  const trail = [];
  const trailLength = 5;
  
  for (let i = 0; i < trailLength; i++) {
    const dot = document.createElement('div');
    dot.className = 'cursor-trail';
    dot.style.cssText = `
      position: fixed;
      width: ${10 - i * 2}px;
      height: ${10 - i * 2}px;
      border-radius: 50%;
      background: rgba(102, 126, 234, ${0.3 - i * 0.05});
      pointer-events: none;
      z-index: 9999;
      transition: transform 0.1s ease;
    `;
    document.body.appendChild(dot);
    trail.push({ element: dot, x: 0, y: 0 });
  }
  
  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  
  function animateTrail() {
    trail.forEach((dot, index) => {
      const prevDot = index === 0 ? { x: mouseX, y: mouseY } : trail[index - 1];
      dot.x += (prevDot.x - dot.x) * 0.3;
      dot.y += (prevDot.y - dot.y) * 0.3;
      dot.element.style.transform = `translate(${dot.x}px, ${dot.y}px)`;
    });
    requestAnimationFrame(animateTrail);
  }
  
  animateTrail();
}

// Uncomment to enable cursor trail
// createCursorTrail();

// ============================================
// Form Validation (if forms are added)
// ============================================

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ============================================
// Performance Optimization
// ============================================

// Throttle scroll events
function throttle(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Apply throttling to scroll events
const throttledScroll = throttle(() => {
  // Scroll-based animations here
}, 16);

window.addEventListener('scroll', throttledScroll);

// ============================================
// Loading Animation
// ============================================

window.addEventListener('load', () => {
  document.body.classList.add('loaded');
  
  // Animate hero content
  setTimeout(() => {
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
      heroContent.style.opacity = '1';
      heroContent.style.transform = 'translateY(0)';
    }
  }, 100);
});

// ============================================
// Console Welcome Message
// ============================================

console.log('%c✨ Prompt AI Toolkit', 'font-size: 24px; font-weight: bold; color: #667eea;');
console.log('%cWelcome to our landing page! 🚀', 'font-size: 14px; color: #764ba2;');
