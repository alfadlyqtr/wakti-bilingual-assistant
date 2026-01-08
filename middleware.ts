/**
 * Vercel Edge Middleware for Multi-Tenant Subdomain Routing
 * 
 * This middleware handles subdomain routing for published projects:
 * - wakti.qa or localhost → Main app (pass through)
 * - wakti.ai (root) → Redirect to wakti.qa
 * - *.wakti.ai (subdomains) → Rewrite to /preview/[subdomain]
 */

export const config = {
  matcher: [
    /*
     * Match all request paths except static files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const hostname = request.headers.get('host') || '';
  
  // Handle localhost for development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return; // Pass through to main app
  }
  
  // Handle main app domain (wakti.qa)
  if (hostname === 'wakti.qa' || hostname.startsWith('wakti.qa:')) {
    return; // Pass through to main app
  }
  
  // Handle root domain (wakti.ai) - redirect to marketing/main app
  if (hostname === 'wakti.ai' || hostname.startsWith('wakti.ai:')) {
    return Response.redirect('https://wakti.qa', 308);
  }
  
  // Handle subdomains (*.wakti.ai)
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.wakti\.ai$/i);
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1].toLowerCase();
    
    // Skip www subdomain - redirect to main app
    if (subdomain === 'www') {
      return Response.redirect('https://wakti.qa', 308);
    }
    
    // Rewrite to internal preview route
    // The SPA will handle /preview/:subdomain
    url.pathname = `/preview/${subdomain}`;
    return fetch(url.toString(), {
      headers: request.headers,
      method: request.method,
      body: request.body,
    });
  }
  
  // Default: pass through
  return;
}
