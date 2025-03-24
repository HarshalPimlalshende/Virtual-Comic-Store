document.addEventListener('DOMContentLoaded', function() {
    // Get PDF URL from the data attribute
    const pdfContainer = document.getElementById('pdf-viewer');
    const pdfUrl = pdfContainer.getAttribute('data-pdf-url');
    const viewModeToggle = document.getElementById('toggle-view-mode');
    const viewModeText = document.getElementById('view-mode-text');
    const leftOverlay = document.querySelector('.page-turn-left');
    const rightOverlay = document.querySelector('.page-turn-right');
    
    // PDF.js initialization code
    let pdfDoc = null,
        pageNum = 1,
        pageRendering = false,
        pageNumPending = null,
        scale = 1.5,
        isDoublePage = false, // Start with single page view
        isMobile = window.innerWidth < 768,
        pageFlipping = false,
        cachedPages = {},
        pagePreloading = {}, // Track pages currently being preloaded
        autoHideTimeout = null;
    
    // Create book container
    const bookContainer = document.createElement('div');
    bookContainer.className = 'book-container single-page-mode';
    pdfContainer.appendChild(bookContainer);
    
    // Function to toggle view mode between single and double page
    function toggleViewMode() {
        isDoublePage = !isDoublePage;
        viewModeText.textContent = isDoublePage ? 'Double Page' : 'Single Page';
        
        if (isDoublePage) {
            bookContainer.classList.remove('single-page-mode');
        } else {
            bookContainer.classList.add('single-page-mode');
        }
        
        renderCurrentPages();
    }
    
    // Function to preload a page and cache it
    function preloadPage(num) {
        if (num < 1 || num > pdfDoc.numPages || cachedPages[num] || pagePreloading[num]) return;
        
        // Track pages being preloaded to avoid duplicate requests
        pagePreloading[num] = true;
        
        // Use lower resolution for preloaded pages to speed up initial display
        // They'll be replaced with full resolution when actually viewed
        const preloadScale = scale * 0.8;
        
        // Queue preload with a slight delay to prioritize visible pages
        setTimeout(() => {
            pdfDoc.getPage(num).then(function(page) {
                const viewport = page.getViewport({scale: preloadScale});
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                
                page.render(renderContext).promise.then(() => {
                    cachedPages[num] = canvas;
                    delete pagePreloading[num];
                    
                    // Continue preloading next pages in sequence
                    if (num < pdfDoc.numPages) {
                        preloadPage(num + 1);
                    }
                    if (num > 1) {
                        preloadPage(num - 1);
                    }
                }).catch(err => {
                    console.warn('Error preloading page', num, err);
                    delete pagePreloading[num];
                });
            }).catch(err => {
                console.warn('Error getting page for preload', num, err);
                delete pagePreloading[num];
            });
        }, 100); // Short delay to prioritize visible content
    }
    
    // Function to render current page(s)
    function renderCurrentPages() {
        if (pageRendering) {
            pageNumPending = pageNum;
            return;
        }
        
        pageRendering = true;
        
        // Create new page spread container
        const newPageSpread = document.createElement('div');
        newPageSpread.className = 'page-spread';
        
        // Keep track of whether we're rendering new elements
        let renderedElements = 0;
        let expectedElements = 0;
        
        // For double page mode on larger screens
        if (isDoublePage && !isMobile) {
            // In double page mode, we show pages side by side (even-odd pairs)
            // Adjust to ensure we start with page 1 on the right side (like a real book)
            let leftPageNum, rightPageNum;
            
            if (pageNum % 2 === 0) {
                leftPageNum = pageNum;
                rightPageNum = pageNum + 1;
            } else {
                leftPageNum = pageNum - 1;
                rightPageNum = pageNum;
            }
            
            // Handle cover page (page 1) specially to be by itself
            if (leftPageNum < 1) {
                leftPageNum = null;
            }
            
            // Ensure we don't go past the last page
            if (rightPageNum > pdfDoc.numPages) {
                rightPageNum = null;
            }
            
            // Count expected elements for rendering completion tracking
            if (leftPageNum) expectedElements++;
            if (rightPageNum) expectedElements++;
            
            // Render left page if it exists
            if (leftPageNum) {
                // Preload pages beforehand
                preloadPage(leftPageNum - 2);
                preloadPage(leftPageNum - 1);
                
                if (renderSinglePage(leftPageNum, newPageSpread, 'left-page')) {
                    renderedElements++;
                }
            }
            
            // Render right page if it exists
            if (rightPageNum) {
                // Preload pages beforehand
                preloadPage(rightPageNum + 1);
                preloadPage(rightPageNum + 2);
                
                if (renderSinglePage(rightPageNum, newPageSpread, 'right-page')) {
                    renderedElements++;
                }
            }
            
            // Update displayed page number to show the current spread
            if (leftPageNum && rightPageNum) {
                document.getElementById('page-num').textContent = `${leftPageNum}-${rightPageNum}`;
                pageNum = leftPageNum; // Set to left page
            } else if (leftPageNum) {
                document.getElementById('page-num').textContent = leftPageNum;
                pageNum = leftPageNum;
            } else if (rightPageNum) {
                document.getElementById('page-num').textContent = rightPageNum;
                pageNum = rightPageNum;
            }
        } else {
            // Single page mode - just render the current page
            expectedElements = 1;
            
            // Preload adjacent pages first
            preloadPage(pageNum - 1);
            preloadPage(pageNum + 1);
            
            if (renderSinglePage(pageNum, newPageSpread, 'single-page')) {
                renderedElements++;
            }
            
            document.getElementById('page-num').textContent = pageNum;
        }
        
        // Only replace the old content once all new content is ready
        if (renderedElements === expectedElements) {
            // Use a fade transition to avoid white flash
            newPageSpread.style.opacity = '0';
            
            // Clear the container and add new content
            bookContainer.innerHTML = '';
            bookContainer.appendChild(newPageSpread);
            
            // Fade in the new content
            setTimeout(() => {
                newPageSpread.style.transition = 'opacity 0.15s ease-in';
                newPageSpread.style.opacity = '1';
            }, 20);
            
            document.getElementById('page-count').textContent = pdfDoc.numPages;
            pageRendering = false;
            
            // Process any pending page render
            if (pageNumPending !== null) {
                setTimeout(() => {
                    renderCurrentPages();
                    pageNumPending = null;
                }, 50);
            }
            
            // Auto-hide header after 3 seconds of inactivity
            clearTimeout(autoHideTimeout);
            showHeader();
            autoHideTimeout = setTimeout(hideHeader, 3000);
        } else {
            // If not all elements were rendered, retry shortly
            setTimeout(() => {
                pageRendering = false;
                renderCurrentPages();
            }, 50);
        }
    }
    
    // Function to render a single page, returns true if rendered immediately from cache
    function renderSinglePage(num, container, className) {
        if (cachedPages[num]) {
            // Use cached page if available
            const clonedCanvas = cachedPages[num].cloneNode(true);
            clonedCanvas.className = 'page-canvas ' + className;
            container.appendChild(clonedCanvas);
            return true; // Immediately rendered
        }
        
        // Start asynchronous rendering
        pdfDoc.getPage(num).then(function(page) {
            const viewport = page.getViewport({scale: scale});
            const canvas = document.createElement('canvas');
            canvas.className = 'page-canvas ' + className;
            const ctx = canvas.getContext('2d');
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            
            // Create a background placeholder while rendering
            canvas.style.background = '#f0f0f0';
            container.appendChild(canvas);
            
            page.render(renderContext).promise.then(() => {
                // Store in cache for future use
                cachedPages[num] = canvas.cloneNode(true);
                
                // Animation to fade in the rendered page
                canvas.style.opacity = '0.9';
                canvas.style.transition = 'opacity 0.2s ease-in';
                setTimeout(() => {
                    canvas.style.opacity = '1';
                    canvas.style.background = 'none';
                }, 50);
            });
        }).catch(err => {
            console.error('Error rendering page:', err);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'page-canvas error-page ' + className;
            errorDiv.textContent = 'Error loading page ' + num;
            container.appendChild(errorDiv);
        });
        
        return false; // Asynchronously rendering
    }
    
    // Function to go to previous page(s)
    function prevPage() {
        if (pageFlipping) return;
        
        if (pageNum <= 1) {
            return;
        }
        
        pageFlipping = true;
        
        // Keep the current page spread visible during transition
        // We create a clone of the current spread for animation
        const currentSpread = document.querySelector('.page-spread');
        if (currentSpread) {
            const clonedSpread = currentSpread.cloneNode(true);
            clonedSpread.style.position = 'absolute';
            clonedSpread.style.top = currentSpread.offsetTop + 'px';
            clonedSpread.style.left = currentSpread.offsetLeft + 'px';
            clonedSpread.style.transformOrigin = 'right center';
            clonedSpread.style.zIndex = '200';
            bookContainer.appendChild(clonedSpread);
            
            // Animate the cloned spread
            clonedSpread.style.transition = 'transform 0.2s ease-in-out';
            clonedSpread.style.transform = 'rotateY(-15deg)';
            
            // Prepare the new page and render it behind
            if (isDoublePage && !isMobile) {
                pageNum = Math.max(1, pageNum - 2);
            } else {
                pageNum--;
            }
            
            // Render the new page in the background
            const pageState = { num: pageNum, isDouble: isDoublePage };
            setTimeout(() => {
                // Only update DOM after animation starts
                renderCurrentPages();
                
                // Remove the clone after animation completes
                setTimeout(() => {
                    if (clonedSpread.parentNode) {
                        clonedSpread.parentNode.removeChild(clonedSpread);
                    }
                    pageFlipping = false;
                }, 200);
            }, 50);
        } else {
            // Fallback if no animation possible
            if (isDoublePage && !isMobile) {
                pageNum = Math.max(1, pageNum - 2);
            } else {
                pageNum--;
            }
            renderCurrentPages();
            pageFlipping = false;
        }
    }
    
    // Function to go to next page(s)
    function nextPage() {
        if (pageFlipping) return;
        
        if (pageNum >= pdfDoc.numPages) {
            return;
        }
        
        pageFlipping = true;
        
        // Keep the current page spread visible during transition
        // We create a clone of the current spread for animation
        const currentSpread = document.querySelector('.page-spread');
        if (currentSpread) {
            const clonedSpread = currentSpread.cloneNode(true);
            clonedSpread.style.position = 'absolute';
            clonedSpread.style.top = currentSpread.offsetTop + 'px';
            clonedSpread.style.left = currentSpread.offsetLeft + 'px';
            clonedSpread.style.transformOrigin = 'left center';
            clonedSpread.style.zIndex = '200';
            bookContainer.appendChild(clonedSpread);
            
            // Animate the cloned spread
            clonedSpread.style.transition = 'transform 0.2s ease-in-out';
            clonedSpread.style.transform = 'rotateY(15deg)';
            
            // Prepare the new page and render it behind
            if (isDoublePage && !isMobile) {
                pageNum = Math.min(pdfDoc.numPages, pageNum + 2);
            } else {
                pageNum++;
            }
            
            // Render the new page in the background
            setTimeout(() => {
                // Only update DOM after animation starts
                renderCurrentPages();
                
                // Remove the clone after animation completes
                setTimeout(() => {
                    if (clonedSpread.parentNode) {
                        clonedSpread.parentNode.removeChild(clonedSpread);
                    }
                    pageFlipping = false;
                }, 200);
            }, 50);
        } else {
            // Fallback if no animation possible
            if (isDoublePage && !isMobile) {
                pageNum = Math.min(pdfDoc.numPages, pageNum + 2);
            } else {
                pageNum++;
            }
            renderCurrentPages();
            pageFlipping = false;
        }
    }
    
    // Show/hide header functions
    function showHeader() {
        document.querySelector('.viewer-header').classList.remove('hide');
    }
    
    function hideHeader() {
        document.querySelector('.viewer-header').classList.add('hide');
    }
    
    // Mouse movement shows header
    pdfContainer.addEventListener('mousemove', function() {
        clearTimeout(autoHideTimeout);
        showHeader();
        autoHideTimeout = setTimeout(hideHeader, 3000);
    });
    
    // Swipe gesture navigation using Hammer.js
    const hammer = new Hammer(pdfContainer);
    hammer.on('swipeleft', function() {
        // Zoom in once for each swipe
        zoomIn(0.1); // Smaller increment for swipe zoom
        // Navigate to next page
        nextPage();
    });
    
    hammer.on('swiperight', function() {
        // Zoom in once for each swipe
        zoomIn(0.1); // Smaller increment for swipe zoom
        // Navigate to previous page
        prevPage();
    });
    
    // Helper function for zooming in
    function zoomIn(increment) {
        // Don't exceed maximum zoom level
        if (scale >= 3.0) return;
        scale += increment || 0.2;
        // Clear cache when zoom changes
        cachedPages = {};
        renderCurrentPages();
    }
    
    // Detect tap on left/right page areas
    leftOverlay.addEventListener('click', prevPage);
    rightOverlay.addEventListener('click', nextPage);
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') {
            prevPage();
        } else if (e.key === 'ArrowRight') {
            nextPage();
        } else if (e.key === 'Escape') {
            document.querySelector('a[href*="comic_details"]').click();
        }
    });
    
    // Window resize handler
    window.addEventListener('resize', function() {
        isMobile = window.innerWidth < 768;
        renderCurrentPages();
    });
    
    // Attach click handlers to buttons
    document.getElementById('prev-page').addEventListener('click', prevPage);
    document.getElementById('next-page').addEventListener('click', nextPage);
    viewModeToggle.addEventListener('click', toggleViewMode);
    
    // Set up zoom controls
    document.getElementById('zoom-in').addEventListener('click', function() {
        zoomIn(0.2);
    });
    
    document.getElementById('zoom-out').addEventListener('click', function() {
        if (scale <= 0.8) return;
        scale -= 0.2;
        // Clear cache when zoom changes
        cachedPages = {};
        renderCurrentPages();
    });
    
    // Initialize PDF.js with the PDF URL
    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdf) {
        pdfDoc = pdf;
        document.getElementById('page-count').textContent = pdf.numPages;
        
        // Auto-detect best view mode based on PDF dimensions and screen size
        if (window.innerWidth > 1200) {
            // Start with double page view on large screens
            isDoublePage = true;
            viewModeText.textContent = 'Double Page';
            bookContainer.classList.remove('single-page-mode');
        }
        
        // Initial page rendering
        renderCurrentPages();
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        pdfContainer.innerHTML = '<div class="alert alert-danger">Error loading PDF. Please try again later.</div>';
    });
});
