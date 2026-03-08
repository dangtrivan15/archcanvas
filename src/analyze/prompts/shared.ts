/**
 * Shared Prompt Components
 *
 * Node type registry information, response schema text, and common few-shot
 * examples used across all prompt templates.
 */

import type { ResponseSchema, FewShotExample } from './types';

/**
 * Built-in node types available in ArchCanvas, organized by namespace.
 * Included in all templates so the AI maps components to valid types.
 */
export const NODE_TYPE_REGISTRY_TEXT = `## Available ArchCanvas Node Types
Map each component to one of these built-in node types (namespace/name):

### Compute
  - compute/service: A backend service, API server, or microservice
  - compute/function: A serverless function or lambda
  - compute/worker: A background worker or job processor
  - compute/api-gateway: An API gateway or reverse proxy
  - compute/cron-job: A scheduled/cron job
  - compute/container: A container runtime (Docker, Kubernetes pod)

### Data
  - data/database: A relational or NoSQL database
  - data/cache: An in-memory cache (Redis, Memcached)
  - data/object-storage: Blob/object storage (S3, GCS)
  - data/repository: A code or artifact repository
  - data/search-index: A search engine (Elasticsearch, Meilisearch)
  - data/graph-database: A graph database (Neo4j, Neptune)
  - data/feature-store: A feature store for ML

### Messaging
  - messaging/message-queue: A message queue (RabbitMQ, SQS)
  - messaging/event-bus: An event bus or pub/sub (Kafka, SNS)
  - messaging/stream-processor: A stream processing system (Flink, Kinesis)
  - messaging/notification: A notification service (push, email, SMS)

### Network
  - network/load-balancer: A load balancer or traffic distributor
  - network/cdn: A content delivery network

### Observability
  - observability/logging: A logging aggregation system (ELK, CloudWatch)
  - observability/monitoring: A monitoring/metrics system (Prometheus, Datadog)
  - observability/tracing: A distributed tracing system (Jaeger, Zipkin)
  - observability/llm-monitor: An LLM-specific observability platform for tracking token usage, latency, and evaluation metrics

### Security
  - security/auth-provider: An identity/auth provider (Auth0, Keycloak)
  - security/vault: A secrets manager (HashiCorp Vault, AWS Secrets Manager)
  - security/waf: A web application firewall

### Integration
  - integration/third-party-api: An external/third-party API
  - integration/webhook: Inbound or outbound webhook handlers
  - integration/etl-pipeline: An ETL/data pipeline
  - integration/mcp-server: A Model Context Protocol server

### Client
  - client/web-app: A web application (SPA, SSR)
  - client/mobile-app: A mobile application (iOS, Android, Flutter)
  - client/cli: A command-line interface tool

### AI
  - ai/llm-provider: A large language model provider
  - ai/embedding-service: An embedding/vectorization service
  - ai/vector-store: A vector database (Pinecone, Qdrant)
  - ai/model-serving: A model serving endpoint
  - ai/guardrails: An AI guardrails/safety layer
  - ai/agent: An autonomous AI agent with tool use capabilities
  - ai/rag-pipeline: A Retrieval-Augmented Generation orchestrator
  - ai/prompt-registry: A versioned prompt/template store for managing and serving prompt templates

### Meta
  - meta/canvas-ref: A container node representing a nested .archc canvas or git repo reference
`;

/** Standard response schema for the final inference result */
export const STANDARD_RESPONSE_SCHEMA: ResponseSchema = {
  schemaText: `{
  "architectureName": "string - name for this architecture",
  "architectureDescription": "string - brief description of the overall system",
  "nodes": [
    {
      "id": "string - unique kebab-case identifier",
      "type": "string - one of the built-in node types listed above (namespace/name format)",
      "displayName": "string - human-readable name",
      "description": "string - what this component does",
      "codeRefs": [{"path": "string - file path", "role": "SOURCE|API_SPEC|SCHEMA|DEPLOYMENT|CONFIG|TEST"}],
      "children": [
        { "id": "...", "type": "...", "displayName": "...", "description": "...", "codeRefs": [], "children": [] }
      ]
    }
  ],
  "edges": [
    {
      "from": "string - source node id",
      "to": "string - target node id",
      "type": "SYNC|ASYNC|DATA_FLOW",
      "label": "string - describes the relationship"
    }
  ]
}`,
};

/** Few-shot example: simple web application */
export const WEB_APP_FEW_SHOT: FewShotExample = {
  scenario: 'A full-stack Express.js web application with PostgreSQL, Redis, and background jobs',
  input: `Project type: single-app
Languages: TypeScript (85%)
Frameworks: Express.js (high), React (medium)
Entry points: src/server.ts, src/client/index.tsx
Data stores: postgresql, redis`,
  output: JSON.stringify(
    {
      architectureName: 'Express React App',
      architectureDescription:
        'A full-stack web application with Express.js backend, React frontend, PostgreSQL database, Redis caching, authentication, and background job processing.',
      nodes: [
        {
          id: 'react-frontend',
          type: 'client/web-app',
          displayName: 'React Frontend',
          description: 'Single-page React application with routing and state management.',
          codeRefs: [{ path: 'src/client/index.tsx', role: 'SOURCE' }],
          children: [
            {
              id: 'dashboard-page',
              type: 'client/web-app',
              displayName: 'Dashboard Page',
              description: 'Main dashboard view showing analytics and recent activity.',
              codeRefs: [{ path: 'src/client/pages/Dashboard.tsx', role: 'SOURCE' }],
              children: [],
            },
            {
              id: 'settings-page',
              type: 'client/web-app',
              displayName: 'Settings Page',
              description: 'User and application settings management interface.',
              codeRefs: [{ path: 'src/client/pages/Settings.tsx', role: 'SOURCE' }],
              children: [],
            },
          ],
        },
        {
          id: 'express-api',
          type: 'compute/service',
          displayName: 'Express API Server',
          description:
            'REST API server built with Express.js handling authentication and business logic.',
          codeRefs: [{ path: 'src/server.ts', role: 'SOURCE' }],
          children: [
            {
              id: 'auth-routes',
              type: 'compute/function',
              displayName: 'Auth Routes',
              description: 'Login, register, password reset, and token refresh endpoints.',
              codeRefs: [{ path: 'src/routes/auth.ts', role: 'SOURCE' }],
              children: [],
            },
            {
              id: 'user-routes',
              type: 'compute/function',
              displayName: 'User Routes',
              description: 'User profile CRUD and user management endpoints.',
              codeRefs: [{ path: 'src/routes/users.ts', role: 'SOURCE' }],
              children: [],
            },
            {
              id: 'middleware-stack',
              type: 'compute/function',
              displayName: 'Middleware Stack',
              description: 'Request validation, rate limiting, CORS, and error handling middleware.',
              codeRefs: [{ path: 'src/middleware/index.ts', role: 'SOURCE' }],
              children: [],
            },
          ],
        },
        {
          id: 'auth-provider',
          type: 'security/auth-provider',
          displayName: 'JWT Auth Provider',
          description: 'JWT-based authentication with refresh token rotation.',
          codeRefs: [{ path: 'src/auth/jwt.ts', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'job-worker',
          type: 'compute/worker',
          displayName: 'Background Worker',
          description: 'Processes async jobs like email sending and report generation.',
          codeRefs: [{ path: 'src/workers/index.ts', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'postgresql',
          type: 'data/database',
          displayName: 'PostgreSQL',
          description: 'Primary relational database storing user data and application state.',
          codeRefs: [{ path: 'src/db/schema.sql', role: 'SCHEMA' }],
          children: [],
        },
        {
          id: 'redis-cache',
          type: 'data/cache',
          displayName: 'Redis',
          description: 'In-memory store for session data, cache, and job queue backing.',
          codeRefs: [],
          children: [],
        },
      ],
      edges: [
        { from: 'react-frontend', to: 'express-api', type: 'SYNC', label: 'REST API calls' },
        { from: 'express-api', to: 'auth-provider', type: 'SYNC', label: 'Token verification' },
        { from: 'express-api', to: 'postgresql', type: 'SYNC', label: 'SQL queries (Prisma)' },
        { from: 'express-api', to: 'redis-cache', type: 'SYNC', label: 'Cache reads/writes' },
        { from: 'express-api', to: 'redis-cache', type: 'ASYNC', label: 'Enqueue background jobs' },
        { from: 'job-worker', to: 'redis-cache', type: 'ASYNC', label: 'Dequeue jobs' },
        { from: 'job-worker', to: 'postgresql', type: 'SYNC', label: 'Update job results' },
      ],
    },
    null,
    2,
  ),
};

/** Few-shot example: microservices architecture */
export const MICROSERVICES_FEW_SHOT: FewShotExample = {
  scenario: 'A microservices e-commerce platform with API gateway, multiple services, event bus, and a separate payments subsystem',
  input: `Project type: microservices
Languages: Go (60%), TypeScript (30%)
Frameworks: Gin (medium)
Infrastructure: docker, kubernetes, ci-github
Data stores: postgresql, redis`,
  output: JSON.stringify(
    {
      architectureName: 'Order Processing Platform',
      architectureDescription:
        'A microservices architecture with API gateway, order and inventory services, notification system, observability stack, PostgreSQL databases, Redis cache, Kafka event bus, and a composite payments subsystem managed separately.',
      nodes: [
        {
          id: 'api-gateway',
          type: 'compute/api-gateway',
          displayName: 'Kong API Gateway',
          description: 'Central API gateway handling routing, rate limiting, and authentication.',
          codeRefs: [{ path: 'gateway/kong.yml', role: 'CONFIG' }],
          children: [],
        },
        {
          id: 'order-service',
          type: 'compute/service',
          displayName: 'Order Service',
          description: 'Handles order creation, updates, and lifecycle management.',
          codeRefs: [{ path: 'services/order/main.go', role: 'SOURCE' }],
          children: [
            {
              id: 'order-handler',
              type: 'compute/function',
              displayName: 'Order Handler',
              description: 'HTTP handler for order CRUD operations.',
              codeRefs: [{ path: 'services/order/handler.go', role: 'SOURCE' }],
              children: [],
            },
            {
              id: 'order-saga',
              type: 'compute/function',
              displayName: 'Order Saga',
              description: 'Orchestrates the distributed order fulfillment workflow across services.',
              codeRefs: [{ path: 'services/order/saga.go', role: 'SOURCE' }],
              children: [],
            },
          ],
        },
        {
          id: 'inventory-service',
          type: 'compute/service',
          displayName: 'Inventory Service',
          description: 'Manages product inventory, stock levels, and reservation.',
          codeRefs: [{ path: 'services/inventory/main.go', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'notification-service',
          type: 'messaging/notification',
          displayName: 'Notification Service',
          description: 'Sends email, SMS, and push notifications for order events.',
          codeRefs: [{ path: 'services/notification/main.go', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'payments-subsystem',
          type: 'meta/canvas-ref',
          displayName: 'Payments Subsystem',
          description: 'Separate bounded context handling payment processing, refunds, and PCI compliance. Maintained by the payments team.',
          codeRefs: [],
          children: [],
          args: { repoUrl: 'https://github.com/acme/payments-platform.git', ref: 'v2.3.0' },
        },
        {
          id: 'order-db',
          type: 'data/database',
          displayName: 'Order Database',
          description: 'PostgreSQL database for order and customer data.',
          codeRefs: [{ path: 'services/order/migrations/', role: 'SCHEMA' }],
          children: [],
        },
        {
          id: 'inventory-db',
          type: 'data/database',
          displayName: 'Inventory Database',
          description: 'PostgreSQL database for product catalog and stock levels.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'redis-cache',
          type: 'data/cache',
          displayName: 'Redis Cache',
          description: 'Shared cache for session data, rate limiting counters, and hot product lookups.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'kafka',
          type: 'messaging/event-bus',
          displayName: 'Kafka Event Bus',
          description: 'Event bus for asynchronous inter-service communication.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'monitoring',
          type: 'observability/monitoring',
          displayName: 'Prometheus + Grafana',
          description: 'Metrics collection and dashboarding for all services.',
          codeRefs: [{ path: 'infra/monitoring/', role: 'CONFIG' }],
          children: [],
        },
        {
          id: 'tracing',
          type: 'observability/tracing',
          displayName: 'Jaeger Tracing',
          description: 'Distributed request tracing across microservices.',
          codeRefs: [],
          children: [],
        },
      ],
      edges: [
        { from: 'api-gateway', to: 'order-service', type: 'SYNC', label: 'HTTP/gRPC' },
        { from: 'api-gateway', to: 'inventory-service', type: 'SYNC', label: 'HTTP/gRPC' },
        { from: 'order-service', to: 'order-db', type: 'SYNC', label: 'SQL queries' },
        { from: 'order-service', to: 'kafka', type: 'ASYNC', label: 'OrderCreated events' },
        { from: 'order-service', to: 'payments-subsystem', type: 'SYNC', label: 'Payment initiation (REST)' },
        { from: 'kafka', to: 'inventory-service', type: 'ASYNC', label: 'Reserve stock' },
        { from: 'kafka', to: 'notification-service', type: 'ASYNC', label: 'Send order confirmation' },
        { from: 'inventory-service', to: 'inventory-db', type: 'SYNC', label: 'SQL queries' },
        { from: 'inventory-service', to: 'redis-cache', type: 'SYNC', label: 'Stock level cache' },
        { from: 'order-service', to: 'monitoring', type: 'DATA_FLOW', label: 'Metrics export' },
        { from: 'order-service', to: 'tracing', type: 'DATA_FLOW', label: 'Trace spans' },
      ],
    },
    null,
    2,
  ),
};

/** Few-shot example: data pipeline */
export const DATA_PIPELINE_FEW_SHOT: FewShotExample = {
  scenario: 'A data pipeline with ETL stages, warehouse, streaming, and analytics dashboard',
  input: `Project type: single-app
Languages: Python (90%)
Frameworks: Airflow (high), dbt (medium)
Infrastructure: docker, aws
Data stores: postgresql, s3, redshift`,
  output: JSON.stringify(
    {
      architectureName: 'Analytics Data Pipeline',
      architectureDescription:
        'A data pipeline with Airflow orchestration, multi-stage ETL with extraction, transformation, and loading, S3 data lake, Redshift warehouse, Kafka streaming, and a Metabase analytics dashboard.',
      nodes: [
        {
          id: 'airflow',
          type: 'compute/cron-job',
          displayName: 'Airflow Scheduler',
          description: 'Apache Airflow orchestrating ETL DAGs on hourly and daily schedules.',
          codeRefs: [{ path: 'dags/', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'etl-pipeline',
          type: 'integration/etl-pipeline',
          displayName: 'ETL Pipeline',
          description: 'Multi-stage Extract-Transform-Load pipeline processing raw data from multiple sources.',
          codeRefs: [{ path: 'etl/main.py', role: 'SOURCE' }],
          children: [
            {
              id: 'extractor',
              type: 'compute/function',
              displayName: 'Data Extractor',
              description: 'Pulls raw data from APIs, databases, and file drops into staging area.',
              codeRefs: [{ path: 'etl/extractors/', role: 'SOURCE' }],
              children: [],
            },
            {
              id: 'transformer',
              type: 'compute/function',
              displayName: 'Data Transformer',
              description: 'Cleans, validates, deduplicates, and reshapes raw data using dbt models.',
              codeRefs: [{ path: 'etl/transforms/', role: 'SOURCE' }],
              children: [],
            },
            {
              id: 'loader',
              type: 'compute/function',
              displayName: 'Data Loader',
              description: 'Loads transformed data into the warehouse and updates materialized views.',
              codeRefs: [{ path: 'etl/loaders/', role: 'SOURCE' }],
              children: [],
            },
          ],
        },
        {
          id: 'source-db',
          type: 'data/database',
          displayName: 'Source PostgreSQL',
          description: 'Operational PostgreSQL database used as a primary data source for extraction.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'third-party-apis',
          type: 'integration/third-party-api',
          displayName: 'External Data Sources',
          description: 'Third-party APIs (Stripe, Salesforce, Google Analytics) providing business data.',
          codeRefs: [{ path: 'etl/sources/api_config.yaml', role: 'CONFIG' }],
          children: [],
        },
        {
          id: 's3-lake',
          type: 'data/object-storage',
          displayName: 'S3 Data Lake',
          description: 'Raw, staging, and processed data stored in partitioned S3 buckets.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'warehouse',
          type: 'data/database',
          displayName: 'Redshift Warehouse',
          description: 'Analytical data warehouse for OLAP queries and reporting.',
          codeRefs: [{ path: 'dbt/models/', role: 'SCHEMA' }],
          children: [],
        },
        {
          id: 'kafka-stream',
          type: 'messaging/stream-processor',
          displayName: 'Kafka Streams',
          description: 'Real-time event stream for near-real-time data updates alongside batch ETL.',
          codeRefs: [{ path: 'streaming/consumer.py', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'metabase',
          type: 'client/web-app',
          displayName: 'Metabase Dashboard',
          description: 'Self-service analytics dashboard for business users and stakeholders.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'pipeline-monitor',
          type: 'observability/monitoring',
          displayName: 'Pipeline Monitoring',
          description: 'Monitors DAG run health, data freshness SLAs, and alerts on pipeline failures.',
          codeRefs: [{ path: 'monitoring/alerts.yaml', role: 'CONFIG' }],
          children: [],
        },
      ],
      edges: [
        { from: 'airflow', to: 'etl-pipeline', type: 'SYNC', label: 'Triggers DAG run' },
        { from: 'source-db', to: 'etl-pipeline', type: 'DATA_FLOW', label: 'CDC extraction' },
        { from: 'third-party-apis', to: 'etl-pipeline', type: 'DATA_FLOW', label: 'API data pull' },
        { from: 'etl-pipeline', to: 's3-lake', type: 'DATA_FLOW', label: 'Raw + processed data' },
        { from: 's3-lake', to: 'warehouse', type: 'DATA_FLOW', label: 'Transformed data load' },
        { from: 'kafka-stream', to: 's3-lake', type: 'DATA_FLOW', label: 'Real-time event ingestion' },
        { from: 'warehouse', to: 'metabase', type: 'SYNC', label: 'SQL queries' },
        { from: 'airflow', to: 'pipeline-monitor', type: 'DATA_FLOW', label: 'DAG metrics + alerts' },
      ],
    },
    null,
    2,
  ),
};
