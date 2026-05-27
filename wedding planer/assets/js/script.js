document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // STICKY HEADER & NAV SCROLL EFFECT
    // ==========================================================================
    const header = document.querySelector('.header');
    const topbar = document.querySelector('.topbar');
    const backToTop = document.getElementById('backToTop');
    
    window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY;
        
        // Sticky Header scroll threshold
        const threshold = topbar ? topbar.offsetHeight : 40;
        if (scrollPos > threshold) {
            header.classList.add('sticky');
        } else {
            header.classList.remove('sticky');
        }
        
        // Back To Top button visibility
        if (scrollPos > 300) {
            backToTop.classList.add('active');
        } else {
            backToTop.classList.remove('active');
        }
    });

    // Back to top action
    backToTop.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // ==========================================================================
    // MOBILE NAVIGATION
    // ==========================================================================
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.navbar-nav');
    const navLinks = document.querySelectorAll('.nav-link');
    
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Handle Dropdown clicks on Mobile
    const dropdownItems = document.querySelectorAll('.nav-item-dropdown');
    dropdownItems.forEach(item => {
        const link = item.querySelector('.nav-link');
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                item.classList.toggle('active');
            }
        });
    });

    // Close mobile nav when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const isDropdownTrigger = link.parentElement.classList.contains('nav-item-dropdown');
            if (window.innerWidth <= 768 && !isDropdownTrigger) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    });

    // ==========================================================================
    // HERO IMAGE SLIDER (KEN BURNS)
    // ==========================================================================
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    let currentSlide = 0;
    const slideInterval = 6000; // 6 seconds
    
    if (slides.length > 0) {
        function showSlide(index) {
            slides.forEach(slide => slide.classList.remove('active'));
            dots.forEach(dot => dot.classList.remove('active'));
            
            slides[index].classList.add('active');
            dots[index].classList.add('active');
            currentSlide = index;
        }
        
        function nextSlide() {
            let next = (currentSlide + 1) % slides.length;
            showSlide(next);
        }
        
        // Auto play
        let slideTimer = setInterval(nextSlide, slideInterval);
        
        // Dot clicks
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                clearInterval(slideTimer);
                showSlide(index);
                slideTimer = setInterval(nextSlide, slideInterval);
            });
        });
    }

    // ==========================================================================
    // TESTIMONIAL CAROUSEL
    // ==========================================================================
    const testimonialTrack = document.querySelector('.testimonials-track');
    const testimonialSlides = document.querySelectorAll('.testimonial-slide');
    const prevArrow = document.querySelector('.slider-arrow-prev');
    const nextArrow = document.querySelector('.slider-arrow-next');
    let currentTestimonial = 0;
    
    if (testimonialTrack && testimonialSlides.length > 0) {
        function updateTestimonial(index) {
            testimonialTrack.style.transform = `translateX(-${index * 100}%)`;
            currentTestimonial = index;
        }
        
        prevArrow.addEventListener('click', () => {
            let index = currentTestimonial - 1;
            if (index < 0) index = testimonialSlides.length - 1;
            updateTestimonial(index);
        });
        
        nextArrow.addEventListener('click', () => {
            let index = (currentTestimonial + 1) % testimonialSlides.length;
            updateTestimonial(index);
        });
        
        // Auto scroll testimonials
        setInterval(() => {
            let index = (currentTestimonial + 1) % testimonialSlides.length;
            updateTestimonial(index);
        }, 8000);
    }

    // ==========================================================================
    // MILESTONES COUNTER ANIMATION
    // ==========================================================================
    const milestoneNums = document.querySelectorAll('.milestone-item-num');
    let countersStarted = false;
    
    function startCounters() {
        milestoneNums.forEach(num => {
            const target = parseInt(num.getAttribute('data-target'));
            const duration = 2000; // 2 seconds
            const speed = target / (duration / 16); // 60 FPS roughly
            let current = 0;
            
            const updateCount = () => {
                current += speed;
                if (current < target) {
                    num.innerText = Math.floor(current) + (num.getAttribute('data-suffix') || '');
                    requestAnimationFrame(updateCount);
                } else {
                    num.innerText = target + (num.getAttribute('data-suffix') || '');
                }
            };
            updateCount();
        });
    }
    
    // Intersection observer for counters
    const counterSection = document.querySelector('.milestones-wrap');
    if (counterSection) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !countersStarted) {
                countersStarted = true;
                startCounters();
                observer.unobserve(counterSection);
            }
        }, { threshold: 0.5 });
        
        observer.observe(counterSection);
    }

    // ==========================================================================
    // SCROLL ANIMATIONS (FADE-IN UP)
    // ==========================================================================
    const scrollAnims = document.querySelectorAll('.fade-in-up-scroll');
    if (scrollAnims.length > 0) {
        const animObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    animObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        
        scrollAnims.forEach(anim => animObserver.observe(anim));
    }

    // ==========================================================================
    // FILTERABLE GALLERY PORTFOLIO
    // ==========================================================================
    const filterButtons = document.querySelectorAll('.gallery-filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Set active button style
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const filterValue = btn.getAttribute('data-filter');
                
                galleryItems.forEach(item => {
                    if (filterValue === 'all') {
                        item.style.display = 'block';
                        setTimeout(() => item.style.opacity = '1', 50);
                    } else {
                        const itemCategory = item.getAttribute('data-category');
                        if (itemCategory === filterValue) {
                            item.style.display = 'block';
                            setTimeout(() => item.style.opacity = '1', 50);
                        } else {
                            item.style.opacity = '0';
                            setTimeout(() => item.style.display = 'none', 300);
                        }
                    }
                });
            });
        });
    }

    // ==========================================================================
    // LIGHTBOX GALLERY MODAL
    // ==========================================================================
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.querySelector('.lightbox-close');
    
    if (lightboxModal && galleryItems.length > 0) {
        galleryItems.forEach(item => {
            const img = item.querySelector('.gallery-img');
            item.addEventListener('click', (e) => {
                // Prevent trigger if overlay has secondary action buttons
                if (e.target.closest('a')) return;
                
                lightboxImg.src = img.src;
                lightboxModal.style.display = 'flex';
                document.body.style.overflow = 'hidden'; // Stop scrolling
            });
        });
        
        lightboxClose.addEventListener('click', () => {
            lightboxModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
        
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) {
                lightboxModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // ==========================================================================
    // ENQUIRY FORM VALIDATION & SUBMISSION
    // ==========================================================================
    const enquiryForm = document.getElementById('enquiryForm');
    
    if (enquiryForm) {
        enquiryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Basic fields validation
            const name = document.getElementById('enquiryName').value.trim();
            const email = document.getElementById('enquiryEmail').value.trim();
            const phone = document.getElementById('enquiryPhone').value.trim();
            const service = document.getElementById('enquiryService').value;
            const message = document.getElementById('enquiryMessage').value.trim();
            
            if (name === '' || email === '' || phone === '' || service === '') {
                alert('Please fill out all required fields marked with an asterisk (*).');
                return;
            }
            
            // Email structure test
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Please enter a valid email address.');
                return;
            }
            
            // Phone length test
            const phoneRegex = /^[0-9]{10,12}$/;
            if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
                alert('Please enter a valid phone number (10-12 digits).');
                return;
            }
            
            // Create a Premium Toast or Alert
            const submitBtn = enquiryForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Sending Enquiry...';
            
            // Mock backend response delay
            setTimeout(() => {
                // Show a successful modal or container styling
                const formParent = enquiryForm.parentElement;
                
                // Keep same height
                formParent.style.minHeight = formParent.offsetHeight + 'px';
                
                formParent.innerHTML = `
                    <div style="text-align: center; color: var(--text-dark); padding: 40px 20px;">
                        <div style="font-size: 4rem; color: var(--primary-dark); margin-bottom: 20px;">
                            <i class="far fa-check-circle"></i>
                        </div>
                        <h3 style="font-family: var(--font-heading); font-size: 1.8rem; margin-bottom: 15px;">Thank You, ${name}!</h3>
                        <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 30px;">
                            Your enquiry for <strong>${service}</strong> has been successfully received. 
                            Our wedding coordinator will reach out to you within the next 24 hours to schedule your free consultation.
                        </p>
                        <button onclick="window.location.reload();" class="btn btn-double-border" style="background-color: transparent;">Send another enquiry</button>
                    </div>
                `;
            }, 1500);
        });
    }
});
