# PENDING BACKEND WORK (Based on SRS.md + progress.md + schema.prisma)

## 1. Authentication / User Accounts
- [ ] Social login (Google/Facebook/Apple) – Required by SRS
- [ ] User bookmarks / saved news system
- [ ] User profile update endpoints (confirmation needed)

---

## 2. News System
- [ ] AI-based news recommendation engine (SRS future-proof feature)
- [ ] Multi-language translation workflow (Italian + English) – backend supports enum but no translation management APIs exist

---

## 3. Media & File Storage
- [ ] Migrate from local storage → AWS S3 or DigitalOcean Spaces (SRS scalability requirement)
- [ ] Global file cleanup job (delete orphaned files)
- [ ] Video transcoding optimization (optional)

---

## 4. Advertisement System
- [ ] Automatic invoice PDF generation for advertiser payments

---

## 5. External Platform Integrations (SRS Required 4 Integrations)
Missing:
- [ ] TG Aziende integration
- [ ] Mercatino integration
- [ ] MyDoctor integration
- [ ] One more external platform (SRS mentions 4 total)

✔ Only TG Calabria is implemented.

---

## 6. Admin CMS Management
- [ ] Homepage layout manager (sliders, blocks, tickers) – required by SRS
- [ ] Custom page builder (if part of SRS expectations)

---

## 7. Deployment & DevOps (Critical)
- [ ] Dockerfile for production
- [ ] PM2 ecosystem file
- [ ] Nginx config (reverse proxy, caching)
- [ ] CI/CD pipeline
- [ ] Environment variable documentation
- [ ] Backup & restore strategy
- [ ] Monitoring & error tracking (Sentry)
- [ ] Server scaling guidelines

---

## 8. Testing (Major Missing Component)
- [ ] Unit tests for services
- [ ] Integration tests for controllers/routes
- [ ] E2E API tests
- [ ] Mocking Prisma for tests
- [ ] Test database (SQLite or separate MySQL)

---

## 9. Documentation
- [ ] Developer guide
- [ ] Admin panel usage guide
- [ ] Advertiser panel usage guide
- [ ] System architecture document
- [ ] Deployment guide

---

## 10. Optimization & Security
- [ ] Rate limit per role (admin vs public)
- [ ] Upload size restriction enforcement
- [ ] CDN integration for static assets
- [ ] Monitoring dashboard for server health

---

## 11. Optional Enhancements Mentioned in SRS
- [ ] Dark mode system
- [ ] Push notifications for browsers
- [ ] AI moderation for images/content
- [ ] Load testing (Artillery/k6)

---

# SUMMARY
Even though backend is **97% implemented**, the following remain:

- Deployment  
- Testing  
- External integrations  
- Invoices  
- Storage migration  
- A few SRS-required UX features

