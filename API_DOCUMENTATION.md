# 🗄️ Database Query Execution Portal API Documentation

## 🚀 Quick Access

### 📖 Interactive Documentation (Swagger UI)

**Production:** https://database-query-execution-portal.onrender.com/api-docs  
**Local Development:** http://localhost:3000/api-docs

### 🔗 Access from Frontend App

1. **Login** to the [Database Portal](https://database-query-execution-portal.vercel.app)
2. **Click your profile** in the top-right corner
3. **Select "API Documentation"** from the dropdown menu
4. **Opens in new tab** with full interactive documentation

### 📊 API Information Endpoint

**Production:** https://database-query-execution-portal.onrender.com/api-info  
**Local Development:** http://localhost:3000/api-info

## 🎯 What You Can Do

The Swagger documentation provides:

- **🧪 Interactive Testing** - Test all endpoints directly in your browser
- **🔐 Built-in Authentication** - Login and authorize with JWT tokens
- **📋 Complete Schemas** - See all request/response formats
- **� Live Examples** - Pre-filled examples for every endpoint
- **📁 File Upload Testing** - Test script uploads with drag & drop
- **🔍 Search & Filter** - Find endpoints quickly
- **📱 Mobile Friendly** - Works on all devices

## 📚 API Overview

The Database Query Execution Portal API provides secure endpoints for:

- **🔑 Authentication** - JWT-based user authentication
- **📝 Request Management** - Submit database queries and scripts
- **👥 Approval Workflow** - Review and approve/reject requests
- **⚡ Execution** - Execute approved requests in secure sandbox
- **📁 File Management** - Upload JavaScript execution scripts
- **📥 Result Downloads** - Download execution results as CSV

## 🔐 Authentication Flow

### Step 1: Get JWT Token

```bash
curl -X POST https://database-query-execution-portal.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

### Step 2: Use Token in Swagger UI

1. **Copy the token** from the login response
2. **Click "Authorize"** button in Swagger UI (🔒 icon)
3. **Enter:** `Bearer <your-token>`
4. **Click "Authorize"** to save
5. **Test any endpoint** - authentication is automatic!

## 🔄 Complete Workflow Example

### 1. 🔑 Login
```bash
POST /auth/login
{
  "email": "analyst@company.com",
  "password": "secure123"
}
```

### 2. 📝 Submit Query Request
```bash
POST /requests
{
  "request_type": "QUERY",
  "pod_id": 1,
  "db_instance": "postgres-prod",
  "db_name": "analytics_db",
  "content": "SELECT COUNT(*) FROM users WHERE active = true",
  "comment": "Monthly active users report"
}
```

### 3. 👥 Manager Approval
```bash
GET /approvals/pending?status=PENDING
POST /approvals/123/approve
```

### 4. ⚡ Execute Request
```bash
POST /execute/123
```

### 5. 📥 Download Results
```bash
GET /executions/456/download
```

## 📊 Response Examples

### ✅ Success Response
```json
{
  "message": "Request executed successfully",
  "executionId": 456,
  "result": {
    "rowCount": 1250,
    "rows": [
      {"count": 1250}
    ],
    "executionTime": 847.2
  }
}
```

### ❌ Error Response
```json
{
  "message": "Validation error: pod_id is required"
}
```

### 📋 Paginated Response
```json
{
  "requests": [...],
  "total": 156,
  "totalPages": 16,
  "currentPage": 1,
  "count": 10
}
```

## 🏷️ API Endpoints by Category

### 🔐 Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - User logout
- `POST /auth/cleanup-tokens` - Cleanup expired tokens

### 📝 Requests
- `GET /requests/database-types` - Get supported database types
- `GET /requests/instances` - Get database instances
- `GET /requests/databases` - Get databases from instance
- `POST /requests` - Submit new request (query/script)
- `GET /requests/{id}/script` - Get script content

### 👥 Approvals (Manager Role Required)
- `GET /approvals/pending` - Get pending approvals (with filters)
- `GET /approvals/{id}/script` - Get script preview
- `POST /approvals/{id}/approve` - Approve request
- `POST /approvals/{id}/reject` - Reject request

### ⚡ Execution
- `POST /execute/{id}` - Execute approved request
- `GET /executions/{id}/download` - Download results as CSV

### 🏢 PODs
- `GET /pods` - Get all PODs

### 📊 Submissions
- `GET /submissions/counts` - Get submission status counts
- `GET /submissions` - Get user submissions (paginated)
- `GET /submissions/{id}` - Get submission details
- `POST /submissions/{id}/clone` - Clone submission
- `GET /submissions/{id}/edit` - Get submission for editing
- `PATCH /submissions/{id}` - Update draft submission
- `POST /submissions/{id}/submit` - Submit draft for approval

## �️ Security Features

- **🔐 JWT Authentication** - Secure token-based authentication
- **👥 Role-based Access** - Different permissions for users and managers
- **🛡️ VM Sandbox** - Script execution in isolated environment
- **📁 File Validation** - JavaScript file type and size validation (16MB max)
- **✅ Request Approval** - All requests require manager approval
- **📋 Audit Trail** - Complete tracking of all requests and executions

## 🚦 Rate Limits & Constraints

- **📁 File Upload:** Maximum 16MB for JavaScript files
- **⏱️ Execution Timeout:** 10 seconds per request
- **� Auto-deploy:** Changes deploy automatically on git push
- **❄️ Cold Starts:** ~30 seconds after 15 minutes idle (Render free tier)

## 🐛 HTTP Status Codes

- **200** ✅ Success
- **201** ✅ Created (new resource)
- **400** ❌ Bad Request (validation errors)
- **401** 🔒 Unauthorized (authentication required)
- **403** 🚫 Forbidden (insufficient permissions)
- **404** 🔍 Not Found (resource doesn't exist)
- **500** 💥 Internal Server Error (execution failures)

## 🔧 Development Setup

### Local API Testing

1. **Clone repository**
2. **Install dependencies:** `npm install`
3. **Set environment variables** in `.env`
4. **Start server:** `npm start`
5. **Access Swagger:** http://localhost:3000/api-docs

### Environment Variables

```env
PORT=3000
JWT_SECRET=your-jwt-secret
DATABASE_URL=postgresql://user:pass@host:port/db
MONGODB_URL=mongodb://host:port/db
```

## 📞 Support & Links

- **🌐 Frontend App:** [Database Portal](https://database-query-execution-portal.vercel.app)
- **📖 API Documentation:** [Swagger UI](https://database-query-execution-portal.onrender.com/api-docs)
- **💓 Health Check:** [/health](https://database-query-execution-portal.onrender.com/health)
- **ℹ️ API Info:** [/api-info](https://database-query-execution-portal.onrender.com/api-info)

---

*🚀 Ready for your demo! Last updated: January 2026*