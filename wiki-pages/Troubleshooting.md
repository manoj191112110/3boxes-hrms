# 🔧 Troubleshooting

Common issues and their solutions for NEXUS HRMS. If your issue isn't listed here, please [open a GitHub issue](https://github.com/maheshkpreddy/nexus-hrms/issues).

---

## Table of Contents

1. [Login Issues](#login-issues)
2. [SelectItem Errors](#selectitem-errors)
3. [Demo Data Loading](#demo-data-loading)
4. [Database Issues](#database-issues)
5. [Deployment Issues](#deployment-issues)
6. [Build Errors](#build-errors)
7. [UI/Display Issues](#uidisplay-issues)
8. [Performance Issues](#performance-issues)
9. [FAQ](#faq)

---

## Login Issues

### Issue: "Invalid credentials" error

**Symptoms:**
- Cannot log in with the default credentials
- Getting "Invalid credentials" error message

**Solutions:**

1. **Verify default credentials:**
   ```
   Email: admin@nexushrms.com
   Password: admin123
   ```
   Make sure there are no trailing spaces.

2. **Check if database is connected:**
   If the database is not connected, the app uses demo authentication. Try the demo credentials above.

3. **Clear browser cache:**
   - Chrome: Ctrl+Shift+Delete → Clear cached data
   - Or use an incognito/private window

4. **Check for password changes:**
   If you've previously changed the password, use the new password instead.

### Issue: Login page keeps reloading

**Symptoms:**
- After entering credentials, the page refreshes but doesn't redirect to dashboard

**Solutions:**

1. Check browser console for JavaScript errors (F12 → Console)
2. Clear localStorage: `localStorage.clear()` in browser console
3. Disable browser extensions (ad blockers, etc.)
4. Try a different browser

### Issue: Session expires frequently

**Solutions:**
1. Check if cookies are being blocked
2. Ensure the `NEXT_PUBLIC_APP_URL` is set correctly
3. Try a different browser

---

## SelectItem Errors

### Issue: "A `<SelectItem>` must have a value prop that is not an empty string"

**Symptoms:**
- Console warnings about SelectItem with empty values
- Dropdown components not rendering correctly

**Cause:**
This occurs when a select dropdown receives an option with an empty string (`""`) as the value. The shadcn/ui Select component (built on Radix UI) does not allow empty string values.

**Solutions:**

1. **Check data source:** Ensure all options in dropdown data have non-empty values:
   ```typescript
   // ❌ Bad - empty value
   const options = [{ value: "", label: "None" }, ...]

   // ✅ Good - use a placeholder value
   const options = [{ value: "none", label: "None" }, ...]
   ```

2. **Filter empty values:**
   ```typescript
   const filteredOptions = options.filter(opt => opt.value !== "")
   ```

3. **Use placeholder prop instead:**
   ```tsx
   <Select>
     <SelectTrigger>
       <SelectValue placeholder="Select an option" />
     </SelectTrigger>
     <SelectContent>
       {options.map(opt => (
         <SelectItem key={opt.value} value={opt.value}>
           {opt.label}
         </SelectItem>
       ))}
     </SelectContent>
   </Select>
   ```

4. **If demo data has empty values:** The demo data should be updated. Check `src/lib/demo-data.ts` for any entries with empty string values.

---

## Demo Data Loading

### Issue: Page shows "No data found" instead of demo data

**Symptoms:**
- Empty tables/lists on module pages
- "No data found" message when expecting demo content

**Solutions:**

1. **Check API response:** Open browser DevTools → Network tab → Reload page → Check the API response
   - If response is `[]` (empty array), demo fallback may not be working
   - If response is a 500 error, check the server logs

2. **Verify demo data import:** Check that `demo-data.ts` exports the correct data for the module

3. **Check error handling in API route:**
   ```typescript
   // Ensure the catch block returns demo data
   try {
     const data = await prisma.model.findMany()
     return Response.json(data)
   } catch (error) {
     console.error('DB Error:', error)
     return Response.json(demoData) // This line must exist
   }
   ```

4. **Restart the dev server:** Sometimes hot reload doesn't pick up changes to demo data files:
   ```bash
   # Stop the server (Ctrl+C)
   bun dev
   ```

### Issue: Demo data appears but looks incomplete

**Solutions:**
1. Check if the demo data arrays have sufficient entries
2. Some demo data may depend on other demo data (e.g., employees need departments)
3. Clear the database and re-seed: `npx prisma db push --force-reset && npx prisma db seed`

---

## Database Issues

### Issue: "Can't reach database server"

**Symptoms:**
- Connection errors in console
- API endpoints returning demo data instead of real data

**Solutions:**

1. **Verify connection string:**
   ```bash
   # Check .env file
   echo $POSTGRES_URL
   ```
   Should be in format: `postgresql://user:password@host:port/database?sslmode=require`

2. **Test connection manually:**
   ```bash
   npx prisma db pull
   ```
   If this fails, the connection string is incorrect.

3. **Neon-specific issues:**
   - Neon databases go to sleep after inactivity. The first request may be slow.
   - Ensure `sslmode=require` is in the connection string
   - Check that the Neon project is active (not suspended)

4. **Local PostgreSQL issues:**
   - Verify PostgreSQL is running: `pg_isready`
   - Check authentication: `psql -U postgres -c "SELECT 1"`
   - Ensure the database exists: `createdb nexus_hrms`

### Issue: Prisma Client not generated

**Symptoms:**
- Import errors for `@prisma/client`
- "Cannot find module" errors

**Solutions:**
```bash
# Regenerate Prisma Client
npx prisma generate

# If that doesn't work, try:
rm -rf node_modules/.prisma
npx prisma generate
```

### Issue: Migration errors

**Solutions:**
```bash
# Reset and reapply
npx prisma migrate reset

# Or push schema directly (without migration history)
npx prisma db push
```

---

## Deployment Issues

### Issue: Build fails on Vercel

**Symptoms:**
- Vercel build step fails with errors
- Deployment shows "Build Error"

**Solutions:**

1. **Check build locally first:**
   ```bash
   bun run build
   ```
   Fix any errors before deploying.

2. **Environment variables:** Ensure all required env vars are set in Vercel:
   - Go to Project Settings → Environment Variables
   - Add `POSTGRES_URL`

3. **Prisma generate in build:** Ensure `postinstall` script is configured:
   ```json
   {
     "scripts": {
       "postinstall": "prisma generate"
     }
   }
   ```

4. **Node.js version:** Set Node.js 18+ in Vercel settings

### Issue: API returns 500 on Vercel

**Solutions:**
1. Check Vercel function logs: Project → Functions → View Logs
2. Verify environment variables are set
3. Check database connection from Vercel (Neon allows connections from Vercel IPs by default)
4. Ensure Prisma Client is generated during build

### Issue: Cold start timeout

**Solutions:**
1. Neon serverless has a cold start. First request may take 2-3 seconds.
2. Consider using Vercel's edge functions for faster cold starts
3. Enable Neon's connection pooling

---

## Build Errors

### Issue: TypeScript compilation errors

**Solutions:**

1. **Strict type checking:**
   ```bash
   npx tsc --noEmit
   ```
   Review and fix type errors.

2. **Missing type definitions:**
   ```bash
   bun add -d @types/node @types/react
   ```

3. **Prisma types not found:**
   ```bash
   npx prisma generate
   ```

### Issue: ESLint errors blocking build

**Solutions:**

1. **Review lint errors:**
   ```bash
   bun run lint
   ```

2. **Auto-fix:**
   ```bash
   npx eslint --fix src/
   ```

3. **Temporarily disable lint on build** (not recommended for production):
   ```json
   { "scripts": { "build": "next build --no-lint" } }
   ```

---

## UI/Display Issues

### Issue: Sidebar not visible on mobile

**Solutions:**
1. Click the hamburger menu (☰) to toggle sidebar
2. The sidebar is responsive and auto-hides on small screens
3. Check that the viewport meta tag is present in layout

### Issue: Charts not rendering

**Solutions:**
1. Ensure Recharts is installed: `bun add recharts`
2. Charts require a container with defined height
3. Check browser console for Recharts errors
4. Verify data format matches chart component expectations

### Issue: Dark mode not working

**Solutions:**
1. Click the theme toggle in the top navbar
2. Check that ThemeProvider wraps the application
3. Clear localStorage and reload

---

## Performance Issues

### Issue: Slow page loads

**Solutions:**

1. **Enable Next.js optimizations:**
   ```typescript
   // next.config.ts
   export default {
     images: { optimize: true },
     compiler: { removeConsole: process.env.NODE_ENV === 'production' }
   }
   ```

2. **Database query optimization:**
   - Add proper indexes in Prisma schema
   - Use `select` to fetch only needed fields
   - Implement pagination for large datasets

3. **Bundle size reduction:**
   ```bash
   # Analyze bundle
   ANALYZE=true bun run build
   ```

### Issue: High memory usage

**Solutions:**
1. Check for memory leaks in useEffect hooks
2. Implement proper cleanup in component unmount
3. Use React.memo for expensive components
4. Virtualize long lists

---

## FAQ

### Q: Can I use NEXUS HRMS without a database?
**A:** Yes! NEXUS HRMS automatically falls back to demo data when no database is configured. All UI features are fully functional with demo data.

### Q: How do I reset the demo data?
**A:** Simply refresh the page. Demo data is generated on each API call. If using a real database, run `npx prisma db push --force-reset && npx prisma db seed`.

### Q: Can I customize the theme/colors?
**A:** Yes, modify the CSS variables in `src/app/globals.css` and the Tailwind configuration in `tailwind.config.ts`.

### Q: How do I add a new module?
**A:** Follow the development guidelines in [Development Guidelines](Development-Guidelines). The pattern is: create API route → create page component → add sidebar navigation.

### Q: Is there a mobile app?
**A:** NEXUS HRMS is fully responsive and works great on mobile browsers. A dedicated mobile app is on the roadmap.

### Q: How do I import employee data?
**A:** Use the CSV import feature in the Employees module. Go to Employees → Import → Upload CSV. The CSV format should match the employee model fields.

### Q: Can I use MySQL instead of PostgreSQL?
**A:** NEXUS HRMS is built for PostgreSQL. While Prisma supports MySQL, you would need to update the Prisma schema provider and test compatibility.

### Q: How do I enable email notifications?
**A:** Email notifications require configuring an SMTP server. Add the following environment variables:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=app-password
EMAIL_FROM=noreply@yourcompany.com
```

### Q: How do I change the default admin password?
**A:** Log in with the default credentials, go to Profile → Security → Change Password.

### Q: Can I run NEXUS HRMS on-premises?
**A:** Yes. Clone the repository, set up a local PostgreSQL database, and deploy using Docker or a Node.js server. See [Getting Started](Getting-Started) for setup instructions.

---

*See also: [Getting Started](Getting-Started), [Development Guidelines](Development-Guidelines), [System Architecture](System-Architecture)*
