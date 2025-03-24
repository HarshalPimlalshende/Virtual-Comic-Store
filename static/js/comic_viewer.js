document.addEventListener('DOMContentLoaded', function() {
    // Get PDF URL from the data attribute
    const pdfContainer = document.getElementById('pdf-viewer');
    const pdfUrl = pdfContainer.getAttribute('data-pdf-url');
    
    // PDF.js initialization code
    let pdfDoc = null,
        pageNum = 1,
        pageRendering = false,
        pageNumPending = null,
        scale = 1.5;
    
    // Function to render the current page
    function renderPage(num) {
        pageRendering = true;
        
        // Using the promise to fetch the page
        pdfDoc.getPage(num).then(function(page) {
            const viewport = page.getViewport({scale: scale});
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Render PDF page
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            
            // Clear the container before adding new canvas
            pdfContainer.innerHTML = '';
            pdfContainer.appendChild(canvas);
            
            const renderTask = page.render(renderContext);
            
            // Wait for rendering to finish
            renderTask.promise.then(function() {
                pageRendering = false;
                
                // Update page counters
                document.getElementById('page-num').textContent = num;
                document.getElementById('page-count').textContent = pdfDoc.numPages;
                
                // If another page rendering is pending, render that page
                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            });
        });
    }
    
    // Function to go to previous page
    function prevPage() {
        if (pageNum <= 1) {
            return;
        }
        pageNum--;
        queueRenderPage(pageNum);
    }
    
    // Function to go to next page
    function nextPage() {
        if (pageNum >= pdfDoc.numPages) {
            return;
        }
        pageNum++;
        queueRenderPage(pageNum);
    }
    
    // Function to queue rendering of a page
    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') {
            prevPage();
        } else if (e.key === 'ArrowRight') {
            nextPage();
        }
    });
    
    // Attach click handlers to buttons
    document.getElementById('prev-page').addEventListener('click', prevPage);
    document.getElementById('next-page').addEventListener('click', nextPage);
    
    // Set up zoom controls
    document.getElementById('zoom-in').addEventListener('click', function() {
        scale += 0.2;
        queueRenderPage(pageNum);
    });
    
    document.getElementById('zoom-out').addEventListener('click', function() {
        if (scale <= 0.5) return;
        scale -= 0.2;
        queueRenderPage(pageNum);
    });
    
    // Initialize PDF.js with the PDF URL
    pdfjsLib.getDocument(pdfUrl).promise.then(function(pdf) {
        pdfDoc = pdf;
        document.getElementById('page-count').textContent = pdf.numPages;
        
        // Initial page rendering
        renderPage(pageNum);
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        pdfContainer.innerHTML = '<div class="alert alert-danger">Error loading PDF. Please try again later.</div>';
    });
});
