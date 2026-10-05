import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Authentication and authorization are checked at the resource boundary
// (pages, layouts, route handlers, and server actions), not by path matching.
const isProtected = createRouteMatcher(["/workspaces(.*)", "/findings(.*)", "/evidence(.*)", "/reports(.*)", "/skills(.*)", "/settings(.*)"]);
export default clerkMiddleware(async (auth, request) => { if (isProtected(request)) await auth.protect(); });

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
