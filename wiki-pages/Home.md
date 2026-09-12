# 🏢 Welcome to NEXUS HRMS Wiki

**NEXUS HRMS** is an enterprise-grade, multi-company, AI-driven Human Resource Management System built with cutting-edge web technologies. This wiki serves as the comprehensive documentation hub for developers, administrators, and end-users.

---

## 📋 About NEXUS HRMS

NEXUS HRMS is a full-featured HRMS platform that streamlines every aspect of human resource management — from recruitment and onboarding to payroll, performance management, and offboarding. Powered by AI capabilities, it offers intelligent interview scheduling, chatbot assistance, and predictive analytics.

- **Repository**: [maheshkpreddy/nexus-hrms](https://github.com/maheshkpreddy/nexus-hrms)
- **Live Demo**: Deploy on Vercel with one click
- **License**: MIT

---

## 📚 Wiki Pages

### Getting Started
| Page | Description |
|------|-------------|
| **[Getting Started](Getting-Started)** | Installation, setup, environment variables, and first login |
| **[System Architecture](System-Architecture)** | Technical architecture, technology stack, and deployment overview |

### Developer Documentation
| Page | Description |
|------|-------------|
| **[API Reference](API-Reference)** | Complete REST API documentation with all 26 endpoints |
| **[Database Schema](Database-Schema)** | Entity relationships, Prisma models, and schema reference |
| **[Development Guidelines](Development-Guidelines)** | Code style, TypeScript patterns, Git workflow, and testing |

### User & Admin Guides
| Page | Description |
|------|-------------|
| **[Module Guide](Module-Guide)** | Module-by-module user guide for all 22+ modules |
| **[Role-Based Access](Role-Based-Access)** | RBAC documentation with 14 user roles and permission matrix |

### Support & Training
| Page | Description |
|------|-------------|
| **[Troubleshooting](Troubleshooting)** | Common issues, solutions, and FAQ |
| **[Training Videos](Training-Videos)** | Training video index with durations and voiceover scripts |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/maheshkpreddy/nexus-hrms.git
cd nexus-hrms

# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your POSTGRES_URL

# Generate Prisma client
npx prisma generate

# Start development server
bun dev
```

**Default Login**: `admin@nexushrms.com` / `admin123`

---

## 🏗️ Technology Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | Zustand |
| Backend | Next.js API Routes |
| ORM | Prisma |
| Database | PostgreSQL (Neon) |
| Deployment | Vercel |

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/maheshkpreddy/nexus-hrms/issues)
- **Discussions**: [GitHub Discussions](https://github.com/maheshkpreddy/nexus-hrms/discussions)
- **Wiki**: You're here!

---

*Last updated: March 2025*
