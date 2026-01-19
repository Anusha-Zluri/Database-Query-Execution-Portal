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
        // User Schema (based on actual User entity)
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
              description: 'Unique user identifier',
              example: 1
            },
            username: {
              type: 'string',
              description: 'Unique username',
              example: 'john.doe'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john.doe@company.com'
            },
            name: {
              type: 'string',
              nullable: true,
              description: 'Full display name',
              example: 'John Doe'
            },
            role: {
              type: 'string',
              enum: ['DEVELOPER', 'MANAGER', 'ADMIN'],
              description: 'User role determining permissions',
              example: 'DEVELOPER'
            },
            is_active: {
              type: 'boolean',
              description: 'Whether user account is active',
              example: true
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['id', 'username', 'email', 'role']
        },
        
        // Pod Schema (based on actual Pod entity)
        Pod: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
              description: 'Unique POD identifier',
              example: 1
            },
            name: {
              type: 'string',
              description: 'POD name (team/department)',
              example: 'Data Analytics Team'
            },
            is_active: {
              type: 'boolean',
              description: 'Whether POD is active',
              example: true
            },
            manager_user_id: {
              type: 'integer',
              format: 'int64',
              description: 'ID of the POD manager',
              example: 5
            }
          },
          required: ['id', 'name']
        },
        
        // Database Instance Schema
        DatabaseInstance: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Instance identifier',
              example: 'postgres-prod'
            },
            engine: {
              type: 'string',
              enum: ['postgres', 'mongodb'],
              description: 'Database engine type',
              example: 'postgres'
            },
            description: {
              type: 'string',
              description: 'Human-readable description',
              example: 'Production PostgreSQL cluster'
            }
          },
          required: ['name', 'engine']
        },
        
        // Request Schema (based on actual Request entity)
        Request: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
              description: 'Unique request identifier',
              example: 123
            },
            requester_id: {
              type: 'integer',
              format: 'int64',
              description: 'ID of user who submitted request',
              example: 5
            },
            pod_id: {
              type: 'integer',
              format: 'int64',
              description: 'POD ID this request belongs to',
              example: 1
            },
            request_type: {
              type: 'string',
              enum: ['QUERY', 'SCRIPT'],
              description: 'Type of database operation',
              example: 'QUERY'
            },
            db_instance: {
              type: 'string',
              description: 'Database instance name',
              example: 'postgres-prod'
            },
            db_name: {
              type: 'string',
              description: 'Database name',
              example: 'analytics_db'
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'EXECUTED'],
              description: 'Current request status',
              example: 'PENDING'
            },
            comment: {
              type: 'string',
              nullable: true,
              description: 'Additional context or explanation',
              example: 'Monthly active users report for stakeholders'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'When the request was created',
              example: '2024-01-15T14:30:00Z'
            },
            decided_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the request was approved/rejected',
              example: '2024-01-15T15:45:00Z'
            },
            decided_by: {
              type: 'integer',
              nullable: true,
              description: 'ID of user who approved/rejected',
              example: 3
            },
            rejection_reason: {
              type: 'string',
              nullable: true,
              description: 'Reason for rejection if status is REJECTED',
              example: 'Query contains potentially dangerous operations'
            }
          },
          required: ['id', 'request_type', 'db_instance', 'db_name', 'status']
        },
        
        // RequestQuery Schema (based on actual RequestQuery entity)
        RequestQuery: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique query record identifier',
              example: 456
            },
            request_id: {
              type: 'integer',
              description: 'Associated request ID',
              example: 123
            },
            query_text: {
              type: 'string',
              description: 'SQL or MongoDB query content',
              example: 'SELECT COUNT(*) FROM users WHERE active = true'
            },
            detected_operation: {
              type: 'string',
              nullable: true,
              description: 'Detected SQL operation type',
              example: 'SELECT'
            },
            is_safe: {
              type: 'boolean',
              nullable: true,
              description: 'Whether query is considered safe',
              example: true
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Query record creation timestamp',
              example: '2024-01-15T14:30:00Z'
            }
          },
          required: ['id', 'request_id', 'query_text']
        },
        
        // RequestScript Schema (based on actual RequestScript entity)
        RequestScript: {
          type: 'object',
          properties: {
            request_id: {
              type: 'integer',
              format: 'int64',
              description: 'Associated request ID (primary key)',
              example: 123
            },
            file_path: {
              type: 'string',
              description: 'Path to uploaded script file',
              example: '/uploads/scripts/migration_20240115.js'
            },
            checksum: {
              type: 'string',
              nullable: true,
              description: 'File checksum for integrity verification',
              example: 'sha256:abc123...'
            },
            line_count: {
              type: 'integer',
              nullable: true,
              description: 'Number of lines in script',
              example: 45
            },
            risk_level: {
              type: 'string',
              nullable: true,
              enum: ['LOW', 'HIGH'],
              description: 'Automated risk assessment',
              example: 'LOW'
            },
            has_dangerous_apis: {
              type: 'boolean',
              nullable: true,
              description: 'Whether script contains dangerous API calls',
              example: false
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Script record creation timestamp',
              example: '2024-01-15T14:30:00Z'
            }
          },
          required: ['request_id', 'file_path']
        },
        
        // Execution Schema (based on actual Execution entity)
        Execution: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Unique execution identifier',
              example: 789
            },
            request_id: {
              type: 'integer',
              description: 'Associated request ID',
              example: 123
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'],
              description: 'Execution status',
              example: 'SUCCESS'
            },
            started_at: {
              type: 'string',
              format: 'date-time',
              description: 'Execution start timestamp',
              example: '2024-01-15T16:00:00Z'
            },
            finished_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Execution completion timestamp',
              example: '2024-01-15T16:00:02Z'
            },
            duration_ms: {
              type: 'integer',
              nullable: true,
              description: 'Execution duration in milliseconds',
              example: 1247
            },
            result_json: {
              type: 'object',
              nullable: true,
              description: 'Execution result data',
              example: {
                "rowCount": 1250,
                "rows": [{"count": 1250}]
              }
            },
            error_message: {
              type: 'string',
              nullable: true,
              description: 'Error message if execution failed',
              example: 'Connection timeout'
            },
            stack_trace: {
              type: 'string',
              nullable: true,
              description: 'Full error stack trace',
              example: 'Error: Connection timeout\n    at ...'
            },
            result_file_path: {
              type: 'string',
              nullable: true,
              description: 'Path to CSV result file',
              example: '/results/execution_789.csv'
            },
            is_truncated: {
              type: 'boolean',
              description: 'Whether results were truncated due to size',
              example: false
            }
          },
          required: ['id', 'request_id', 'status', 'started_at']
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