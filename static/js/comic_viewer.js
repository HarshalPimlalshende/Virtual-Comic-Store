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
        if (num < 1 || num > pdfDoc.numPages || cachedPages[num]) return;
        
        pdfDoc.getPage(num).then(function(page) {
            const viewport = page.getViewport({scale: scale});
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
            });
        });
    }
    
    // Function to render current page(s)
    function renderCurrentPages() {
        if (pageRendering) {
            pageNumPending = pageNum;
            return;
        }
        
        pageRendering = true;
        
        // Clear the container
        bookContainer.innerHTML = '';
        
        // Create page spread container
        const pageSpread = document.createElement('div');
        pageSpread.className = 'page-spread';
        
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
            
            // Render left page if it exists
            if (leftPageNum) {
                renderSinglePage(leftPageNum, pageSpread, 'left-page');
                
                // Preload adjacent pages
                preloadPage(leftPageNum - 2);
                preloadPage(leftPageNum - 1);
            }
            
            // Render right page if it exists
            if (rightPageNum) {
                renderSinglePage(rightPageNum, pageSpread, 'right-page');
                
                // Preload adjacent pages
                preloadPage(rightPageNum + 1);
                preloadPage(rightPageNum + 2);
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
            renderSinglePage(pageNum, pageSpread, 'single-page');
            document.getElementById('page-num').textContent = pageNum;
            
            // Preload adjacent pages
            preloadPage(pageNum - 1);
            preloadPage(pageNum + 1);
        }
        
        bookContainer.appendChild(pageSpread);
        document.getElementById('page-count').textContent = pdfDoc.numPages;
        pageRendering = false;
        
        // Process any pending page render
        if (pageNumPending !== null) {
            renderCurrentPages();
            pageNumPending = null;
        }
        
        // Auto-hide header after 3 seconds of inactivity
        clearTimeout(autoHideTimeout);
        showHeader();
        autoHideTimeout = setTimeout(hideHeader, 3000);
    }
    
    // Function to render a single page
    function renderSinglePage(num, container, className) {
        if (cachedPages[num]) {
            // Use cached page if available
            const clonedCanvas = cachedPages[num].cloneNode(true);
            clonedCanvas.className = 'page-canvas ' + className;
            container.appendChild(clonedCanvas);
            return;
        }
        
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
            
            container.appendChild(canvas);
            
            page.render(renderContext).promise.then(() => {
                cachedPages[num] = canvas.cloneNode(true);
            });
        });
    }
    
    // Function to go to previous page(s)
    function prevPage() {
        if (pageFlipping) return;
        
        if (pageNum <= 1) {
            return;
        }
        
        pageFlipping = true;
        
        // Add page flip animation
        const pageSpread = document.querySelector('.page-spread');
        if (pageSpread) {
            pageSpread.style.transformOrigin = 'right center';
            pageSpread.style.transform = 'rotateY(-15deg)';
            
            setTimeout(() => {
                // In double page mode, go back 2 pages
                if (isDoublePage && !isMobile) {
                    pageNum = Math.max(1, pageNum - 2);
                } else {
                    pageNum--;
                }
                
                renderCurrentPages();
                pageSpread.style.transform = '';
                pageFlipping = false;
            }, 200);
        } else {
            // Fallback if no animation
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
        
        // Add page flip animation
        const pageSpread = document.querySelector('.page-spread');
        if (pageSpread) {
            pageSpread.style.transformOrigin = 'left center';
            pageSpread.style.transform = 'rotateY(15deg)';
            
            setTimeout(() => {
                // In double page mode, go forward 2 pages
                if (isDoublePage && !isMobile) {
                    pageNum = Math.min(pdfDoc.numPages, pageNum + 2);
                } else {
                    pageNum++;
                }
                
                renderCurrentPages();
                pageSpread.style.transform = '';
                pageFlipping = false;
            }, 200);
        } else {
            // Fallback if no animation
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
        nextPage();
    });
    
    hammer.on('swiperight', function() {
        prevPage();
    });
    
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
        scale += 0.2;
        // Clear cache when zoom changes
        cachedPages = {};
        renderCurrentPages();
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
