const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Database Query Execution Portal API',
      version: '1.0.0',
      description: `
# Secure Database Query & Script Execution Platform

**Enterprise-grade API for managing database operations with approval workflows**

## Key Features

- **JWT Authentication** - Secure token-based authentication
- **Multi-POD Support** - Organize requests by teams/departments  
- **Multi-Database** - PostgreSQL & MongoDB support
- **Approval Workflow** - Manager approval required for all operations
- **Secure Execution** - Scripts run in isolated VM sandbox
- **Result Export** - Download results as CSV files
- **Audit Trail** - Complete tracking of all operations

## Workflow Process

1. **Authenticate** - Login to receive JWT token
2. **Submit Request** - Create query or script execution request
3. **Manager Review** - Managers approve/reject requests for their PODs
4. **Execute** - Approved requests run in secure sandbox
5. **Download** - Export results as CSV files

## Quick Links

- **Frontend App**: https://database-query-execution-portal.vercel.app
- **Health Check**: /health
- **API Info**: /api-info

## Authentication

Most endpoints require JWT authentication. Get your token from the login endpoint, then click the **Authorize** button above and enter: \`Bearer <your-token>\`
      `,
      contact: {
        name: 'Database Query Execution Portal',
        url: 'https://database-query-execution-portal.vercel.app'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development Server (use this for local testing)'
      },
      {
        url: 'https://database-query-execution-portal.onrender.com',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from `/auth/login` endpoint. Format: `Bearer <token>`'
        }
      },
      schemas: {
        // Authentication Requests
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@company.com'
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'secure123'
            }
          }
        },
        
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer', example: 1 },
                email: { type: 'string', example: 'user@company.com' },
                username: { type: 'string', example: 'john.doe' },
                role: { type: 'string', example: 'DEVELOPER' }
              }
            }
          }
        },
        
        // Request Submission
        SubmitQueryRequest: {
          type: 'object',
          required: ['request_type', 'pod_id', 'db_instance', 'db_name', 'content'],
          properties: {
            request_type: {
              type: 'string',
              enum: ['QUERY'],
              example: 'QUERY'
            },
            pod_id: {
              type: 'integer',
              example: 1
            },
            db_instance: {
              type: 'string',
              example: 'postgres-prod'
            },
            db_name: {
              type: 'string',
              example: 'analytics_db'
            },
            content: {
              type: 'string',
              description: 'SQL or MongoDB query',
              example: 'SELECT COUNT(*) FROM users WHERE active = true'
            },
            comment: {
              type: 'string',
              example: 'Monthly active users report'
            }
          }
        },
        
        SubmitScriptRequest: {
          type: 'object',
          required: ['request_type', 'pod_id', 'db_instance', 'db_name', 'file'],
          properties: {
            request_type: {
              type: 'string',
              enum: ['SCRIPT'],
              example: 'SCRIPT'
            },
            pod_id: {
              type: 'integer',
              example: 1
            },
            db_instance: {
              type: 'string',
              example: 'mongodb-prod'
            },
            db_name: {
              type: 'string',
              example: 'app_db'
            },
            file: {
              type: 'string',
              format: 'binary',
              description: 'JavaScript file (.js)'
            },
            comment: {
              type: 'string',
              example: 'Data migration script'
            }
          }
        },
        
        SubmitRequestResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Request submitted successfully'
            },
            requestId: {
              type: 'integer',
              example: 123
            }
          }
        },
        
        // Approval Responses
        ApprovalListResponse: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 123 },
                  database: { type: 'string', example: 'postgres-prod / analytics_db' },
                  type: { type: 'string', example: 'QUERY' },
                  content: { type: 'string', example: 'SELECT * FROM users LIMIT 10' },
                  requester: { type: 'string', example: 'john.doe@company.com' },
                  pod: { type: 'string', example: 'Data Analytics Team' },
                  status: { type: 'string', example: 'PENDING' },
                  comments: { type: 'string', example: 'Need user data for report' },
                  submitted_at: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'integer', example: 45 },
            totalPages: { type: 'integer', example: 5 },
            currentPage: { type: 'integer', example: 1 },
            count: { type: 'integer', example: 10 }
          }
        },
        
        ApproveResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Request approved successfully'
            }
          }
        },
        
        RejectRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: {
              type: 'string',
              example: 'Query contains potentially dangerous operations'
            }
          }
        },
        
        // Execution Responses
        ExecutionResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Request executed successfully'
            },
            executionId: {
              type: 'integer',
              example: 789
            },
            result: {
              type: 'object',
              properties: {
                rowCount: { type: 'integer', example: 1250 },
                rows: {
                  type: 'array',
                  items: { type: 'object' },
                  example: [{ count: 1250 }]
                },
                executionTime: { type: 'number', example: 847.2 }
              }
            }
          }
        },
        
        // POD Response
        PODListResponse: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              name: { type: 'string', example: 'Data Analytics Team' },
              is_active: { type: 'boolean', example: true }
            }
          }
        },
        
        // Error Response
        ErrorResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Validation error: pod_id is required'
            },
            error: {
              type: 'string',
              example: 'Bad Request'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: '🔐 User authentication and session management',
        externalDocs: {
          description: 'Learn more about JWT',
          url: 'https://jwt.io/introduction'
        }
      },
      {
        name: 'Requests',
        description: '📝 Submit and manage database query/script requests'
      },
      {
        name: 'Approvals',
        description: '👥 Review and approve/reject requests (Manager role required)'
      },
      {
        name: 'Execution',
        description: '⚡ Execute approved requests and download results'
      },
      {
        name: 'PODs',
        description: '🏢 Project/Organization/Department management'
      },
      {
        name: 'Submissions',
        description: '📊 Track your submitted requests and manage drafts'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
};

const specs = swaggerJsdoc(options);
module.exports = specs;