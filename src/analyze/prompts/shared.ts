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
  scenario: 'A simple Express.js web application with PostgreSQL and Redis',
  input: `Project type: single-app
Languages: TypeScript (85%)
Frameworks: Express.js (high), React (medium)
Entry points: src/server.ts, src/client/index.tsx`,
  output: JSON.stringify(
    {
      architectureName: 'Express React App',
      architectureDescription:
        'A full-stack web application with Express.js backend, React frontend, PostgreSQL database, and Redis caching.',
      nodes: [
        {
          id: 'react-frontend',
          type: 'client/web-app',
          displayName: 'React Frontend',
          description: 'Single-page React application served via Express static middleware.',
          codeRefs: [{ path: 'src/client/index.tsx', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'express-api',
          type: 'compute/service',
          displayName: 'Express API Server',
          description:
            'REST API server built with Express.js handling authentication and business logic.',
          codeRefs: [{ path: 'src/server.ts', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'postgresql',
          type: 'data/database',
          displayName: 'PostgreSQL',
          description: 'Primary relational database storing user data and application state.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'redis-cache',
          type: 'data/cache',
          displayName: 'Redis Cache',
          description: 'In-memory cache for session data and frequently accessed queries.',
          codeRefs: [],
          children: [],
        },
      ],
      edges: [
        { from: 'react-frontend', to: 'express-api', type: 'SYNC', label: 'REST API calls' },
        { from: 'express-api', to: 'postgresql', type: 'SYNC', label: 'SQL queries' },
        { from: 'express-api', to: 'redis-cache', type: 'SYNC', label: 'Cache reads/writes' },
      ],
    },
    null,
    2,
  ),
};

/** Few-shot example: microservices architecture */
export const MICROSERVICES_FEW_SHOT: FewShotExample = {
  scenario: 'A microservices system with API gateway, multiple services, and event bus',
  input: `Project type: microservices
Languages: Go (60%), TypeScript (30%)
Frameworks: Gin (medium)
Infrastructure: docker, kubernetes, ci-github
Data stores: postgresql, redis`,
  output: JSON.stringify(
    {
      architectureName: 'Order Processing Platform',
      architectureDescription:
        'A microservices architecture with API gateway, order and inventory services, PostgreSQL databases, Redis cache, and Kafka event bus.',
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
          children: [],
        },
        {
          id: 'inventory-service',
          type: 'compute/service',
          displayName: 'Inventory Service',
          description: 'Manages product inventory and stock levels.',
          codeRefs: [{ path: 'services/inventory/main.go', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'order-db',
          type: 'data/database',
          displayName: 'Order Database',
          description: 'PostgreSQL database for order data.',
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
      ],
      edges: [
        { from: 'api-gateway', to: 'order-service', type: 'SYNC', label: 'HTTP/gRPC' },
        { from: 'api-gateway', to: 'inventory-service', type: 'SYNC', label: 'HTTP/gRPC' },
        { from: 'order-service', to: 'order-db', type: 'SYNC', label: 'SQL queries' },
        { from: 'order-service', to: 'kafka', type: 'ASYNC', label: 'Order events' },
        { from: 'kafka', to: 'inventory-service', type: 'ASYNC', label: 'Stock updates' },
      ],
    },
    null,
    2,
  ),
};

/** Few-shot example: data pipeline */
export const DATA_PIPELINE_FEW_SHOT: FewShotExample = {
  scenario: 'A data pipeline with ETL, warehouse, and analytics',
  input: `Project type: single-app
Languages: Python (90%)
Frameworks: Airflow (high)
Infrastructure: docker, aws
Data stores: postgresql, s3`,
  output: JSON.stringify(
    {
      architectureName: 'Analytics Data Pipeline',
      architectureDescription:
        'A data pipeline with Airflow orchestration, S3 data lake, Snowflake warehouse, and dbt transformations.',
      nodes: [
        {
          id: 'airflow',
          type: 'compute/cron-job',
          displayName: 'Airflow Scheduler',
          description: 'Apache Airflow orchestrating ETL DAGs.',
          codeRefs: [{ path: 'dags/', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 'etl',
          type: 'integration/etl-pipeline',
          displayName: 'ETL Pipeline',
          description: 'Extract-Transform-Load pipeline processing raw data.',
          codeRefs: [{ path: 'etl/main.py', role: 'SOURCE' }],
          children: [],
        },
        {
          id: 's3-lake',
          type: 'data/object-storage',
          displayName: 'S3 Data Lake',
          description: 'Raw and processed data stored in S3 buckets.',
          codeRefs: [],
          children: [],
        },
        {
          id: 'warehouse',
          type: 'data/database',
          displayName: 'Snowflake Warehouse',
          description: 'Analytical data warehouse for reporting queries.',
          codeRefs: [],
          children: [],
        },
      ],
      edges: [
        { from: 'airflow', to: 'etl', type: 'SYNC', label: 'Triggers DAG run' },
        { from: 'etl', to: 's3-lake', type: 'DATA_FLOW', label: 'Raw data ingestion' },
        { from: 's3-lake', to: 'warehouse', type: 'DATA_FLOW', label: 'Transformed data load' },
      ],
    },
    null,
    2,
  ),
};
