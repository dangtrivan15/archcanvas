/**
 * Built-in NodeDef definitions for ArchCanvas.
 * 15 nodedefs organized by namespace: compute, data, messaging, network, observability.
 */

import type { NodeDef } from '@/types/nodedef';

// ============================================================
// COMPUTE NAMESPACE (4 nodedefs)
// ============================================================

const service: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'service',
    namespace: 'compute',
    version: '1.0.0',
    displayName: 'Service',
    description: 'A deployable backend service that handles business logic and exposes APIs.',
    icon: 'Server',
    tags: ['compute', 'backend', 'microservice'],
  },
  spec: {
    args: [
      { name: 'language', type: 'enum', description: 'Primary programming language', options: ['TypeScript', 'Python', 'Go', 'Java', 'Rust', 'C#'], default: 'TypeScript' },
      { name: 'framework', type: 'string', description: 'Web framework used', default: 'Express' },
      { name: 'replicas', type: 'number', description: 'Number of running instances', default: 1 },
      { name: 'healthCheck', type: 'string', description: 'Health check endpoint path', default: '/health' },
    ],
    ports: [
      { name: 'http-in', direction: 'inbound', protocol: ['HTTP', 'HTTPS'], description: 'Incoming HTTP requests' },
      { name: 'http-out', direction: 'outbound', protocol: ['HTTP', 'HTTPS'], description: 'Outgoing HTTP requests' },
      { name: 'grpc-in', direction: 'inbound', protocol: ['gRPC'], description: 'Incoming gRPC calls' },
      { name: 'grpc-out', direction: 'outbound', protocol: ['gRPC'], description: 'Outgoing gRPC calls' },
    ],
    children: [
      { nodedef: 'compute/function', min: 0, max: 50 },
    ],
    ai: {
      context: 'This is a backend service. Consider its API surface, dependencies, scaling needs, and failure modes.',
      reviewHints: ['Check for single points of failure', 'Verify health check endpoint exists', 'Consider circuit breakers for outbound calls'],
    },
  },
  variants: [
    { name: 'REST API', description: 'RESTful HTTP service', args: { framework: 'Express' } },
    { name: 'gRPC Service', description: 'gRPC-based microservice', args: { framework: 'gRPC' } },
  ],
};

const functionNode: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'function',
    namespace: 'compute',
    version: '1.0.0',
    displayName: 'Function',
    description: 'A serverless function or lambda that executes in response to events.',
    icon: 'Zap',
    tags: ['compute', 'serverless', 'lambda'],
  },
  spec: {
    args: [
      { name: 'runtime', type: 'enum', description: 'Execution runtime', options: ['Node.js 20', 'Python 3.12', 'Go 1.22', 'Java 21', 'Rust'], default: 'Node.js 20' },
      { name: 'memory', type: 'number', description: 'Memory allocation in MB', default: 256 },
      { name: 'timeout', type: 'duration', description: 'Maximum execution time', default: '30s' },
      { name: 'trigger', type: 'enum', description: 'Invocation trigger type', options: ['HTTP', 'Schedule', 'Event', 'Queue'], default: 'HTTP' },
    ],
    ports: [
      { name: 'trigger-in', direction: 'inbound', protocol: ['HTTP', 'Event'], description: 'Trigger input' },
      { name: 'call-out', direction: 'outbound', protocol: ['HTTP', 'SDK'], description: 'Outbound calls to other services' },
    ],
    ai: {
      context: 'This is a serverless function. Consider cold start latency, execution time limits, and statelessness.',
      reviewHints: ['Check for cold start optimization', 'Verify timeout is appropriate', 'Ensure function is stateless'],
    },
  },
};

const worker: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'worker',
    namespace: 'compute',
    version: '1.0.0',
    displayName: 'Worker',
    description: 'A background worker process that consumes tasks from a queue or schedule.',
    icon: 'Cog',
    tags: ['compute', 'background', 'async'],
  },
  spec: {
    args: [
      { name: 'concurrency', type: 'number', description: 'Number of concurrent tasks', default: 5 },
      { name: 'retryPolicy', type: 'enum', description: 'Retry behavior on failure', options: ['none', 'fixed', 'exponential'], default: 'exponential' },
      { name: 'maxRetries', type: 'number', description: 'Maximum retry attempts', default: 3 },
    ],
    ports: [
      { name: 'queue-in', direction: 'inbound', protocol: ['AMQP', 'SQS'], description: 'Task queue input' },
      { name: 'result-out', direction: 'outbound', protocol: ['HTTP', 'Event'], description: 'Task result output' },
    ],
    ai: {
      context: 'This is a background worker. Consider idempotency, retry behavior, dead letter queues, and monitoring.',
      reviewHints: ['Verify idempotent task processing', 'Check dead letter queue configuration', 'Consider backpressure handling'],
    },
  },
};

const apiGateway: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'api-gateway',
    namespace: 'compute',
    version: '1.0.0',
    displayName: 'API Gateway',
    description: 'An API gateway that routes, authenticates, and rate-limits incoming requests.',
    icon: 'Shield',
    tags: ['compute', 'gateway', 'routing', 'auth'],
  },
  spec: {
    args: [
      { name: 'provider', type: 'enum', description: 'Gateway provider', options: ['Kong', 'AWS API Gateway', 'Nginx', 'Envoy', 'Custom'], default: 'Custom' },
      { name: 'rateLimit', type: 'number', description: 'Rate limit (requests per minute)', default: 1000 },
      { name: 'authMethod', type: 'enum', description: 'Authentication method', options: ['JWT', 'API Key', 'OAuth2', 'None'], default: 'JWT' },
    ],
    ports: [
      { name: 'public-in', direction: 'inbound', protocol: ['HTTP', 'HTTPS'], description: 'Public-facing ingress' },
      { name: 'route-out', direction: 'outbound', protocol: ['HTTP', 'gRPC'], description: 'Routed requests to backend services' },
    ],
    ai: {
      context: 'This is an API gateway. Consider authentication, rate limiting, request validation, and CORS policies.',
      reviewHints: ['Verify rate limiting is configured', 'Check CORS policy', 'Ensure authentication is enforced'],
    },
  },
};

// ============================================================
// DATA NAMESPACE (4 nodedefs)
// ============================================================

const database: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'database',
    namespace: 'data',
    version: '1.0.0',
    displayName: 'Database',
    description: 'A persistent data store for structured or unstructured data.',
    icon: 'Database',
    tags: ['data', 'storage', 'persistence'],
  },
  spec: {
    args: [
      { name: 'engine', type: 'enum', description: 'Database engine', options: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite', 'DynamoDB', 'CockroachDB'], default: 'PostgreSQL' },
      { name: 'version', type: 'string', description: 'Engine version', default: '16' },
      { name: 'storageGB', type: 'number', description: 'Allocated storage in GB', default: 20 },
      { name: 'replication', type: 'enum', description: 'Replication mode', options: ['none', 'primary-replica', 'multi-primary'], default: 'none' },
    ],
    ports: [
      { name: 'query-in', direction: 'inbound', protocol: ['SQL', 'MongoDB Wire', 'HTTP'], description: 'Incoming queries' },
      { name: 'replication-out', direction: 'outbound', protocol: ['WAL', 'Oplog'], description: 'Replication stream' },
    ],
    ai: {
      context: 'This is a database. Consider schema design, indexing strategy, backup policy, and connection pooling.',
      reviewHints: ['Check for proper indexing', 'Verify backup and recovery plan', 'Consider connection pool sizing'],
    },
  },
  variants: [
    { name: 'PostgreSQL', description: 'Relational database with strong ACID compliance', args: { engine: 'PostgreSQL', version: '16' } },
    { name: 'MongoDB', description: 'Document database for flexible schemas', args: { engine: 'MongoDB', version: '7' } },
  ],
};

const cache: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'cache',
    namespace: 'data',
    version: '1.0.0',
    displayName: 'Cache',
    description: 'An in-memory cache for fast data access and reducing database load.',
    icon: 'HardDrive',
    tags: ['data', 'cache', 'performance'],
  },
  spec: {
    args: [
      { name: 'engine', type: 'enum', description: 'Cache engine', options: ['Redis', 'Memcached', 'Valkey'], default: 'Redis' },
      { name: 'maxMemoryMB', type: 'number', description: 'Maximum memory allocation in MB', default: 512 },
      { name: 'evictionPolicy', type: 'enum', description: 'Key eviction policy', options: ['LRU', 'LFU', 'TTL', 'noeviction'], default: 'LRU' },
      { name: 'ttlSeconds', type: 'number', description: 'Default TTL in seconds', default: 3600 },
    ],
    ports: [
      { name: 'cache-in', direction: 'inbound', protocol: ['Redis', 'Memcached'], description: 'Cache operations' },
    ],
    ai: {
      context: 'This is a cache layer. Consider cache invalidation strategy, TTL policies, and cache-aside vs write-through patterns.',
      reviewHints: ['Verify cache invalidation strategy', 'Check for cache stampede protection', 'Consider cache warming on deploy'],
    },
  },
};

const objectStorage: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'object-storage',
    namespace: 'data',
    version: '1.0.0',
    displayName: 'Object Storage',
    description: 'Blob/object storage for files, images, backups, and large binary data.',
    icon: 'Archive',
    tags: ['data', 'storage', 'blob', 'files'],
  },
  spec: {
    args: [
      { name: 'provider', type: 'enum', description: 'Storage provider', options: ['S3', 'GCS', 'Azure Blob', 'MinIO', 'R2'], default: 'S3' },
      { name: 'bucketName', type: 'string', description: 'Storage bucket name' },
      { name: 'versioning', type: 'boolean', description: 'Enable object versioning', default: false },
      { name: 'publicAccess', type: 'boolean', description: 'Allow public read access', default: false },
    ],
    ports: [
      { name: 'storage-in', direction: 'inbound', protocol: ['S3', 'HTTP'], description: 'Storage operations (put/get/delete)' },
      { name: 'event-out', direction: 'outbound', protocol: ['Event', 'SNS'], description: 'Object lifecycle events' },
    ],
    ai: {
      context: 'This is object storage. Consider access policies, lifecycle rules, CDN integration, and cost optimization.',
      reviewHints: ['Verify access policies are restrictive', 'Check for lifecycle rules on temporary objects', 'Consider CDN for frequently accessed objects'],
    },
  },
};

const repository: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'repository',
    namespace: 'data',
    version: '1.0.0',
    displayName: 'Repository',
    description: 'A data access layer that abstracts database queries behind a clean interface.',
    icon: 'Layers',
    tags: ['data', 'abstraction', 'DAL'],
  },
  spec: {
    args: [
      { name: 'entity', type: 'string', description: 'Primary entity/model name' },
      { name: 'orm', type: 'enum', description: 'ORM or query builder', options: ['Prisma', 'Drizzle', 'TypeORM', 'Knex', 'Raw SQL'], default: 'Prisma' },
      { name: 'softDelete', type: 'boolean', description: 'Use soft deletes', default: false },
    ],
    ports: [
      { name: 'api-in', direction: 'inbound', protocol: ['TypeScript'], description: 'Method calls from services' },
      { name: 'db-out', direction: 'outbound', protocol: ['SQL', 'ORM'], description: 'Database queries' },
    ],
    ai: {
      context: 'This is a repository/data access layer. Consider query optimization, transaction boundaries, and data validation.',
      reviewHints: ['Check for N+1 query issues', 'Verify transaction boundaries', 'Consider pagination for list queries'],
    },
  },
};

// ============================================================
// MESSAGING NAMESPACE (3 nodedefs)
// ============================================================

const messageQueue: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'message-queue',
    namespace: 'messaging',
    version: '1.0.0',
    displayName: 'Message Queue',
    description: 'A message queue for asynchronous communication between services.',
    icon: 'Inbox',
    tags: ['messaging', 'async', 'queue'],
  },
  spec: {
    args: [
      { name: 'broker', type: 'enum', description: 'Message broker', options: ['RabbitMQ', 'SQS', 'ActiveMQ', 'ZeroMQ'], default: 'RabbitMQ' },
      { name: 'durable', type: 'boolean', description: 'Messages survive broker restart', default: true },
      { name: 'maxRetries', type: 'number', description: 'Max delivery retries before DLQ', default: 3 },
      { name: 'dlqEnabled', type: 'boolean', description: 'Dead letter queue enabled', default: true },
    ],
    ports: [
      { name: 'publish-in', direction: 'inbound', protocol: ['AMQP', 'HTTP'], description: 'Message publishing' },
      { name: 'consume-out', direction: 'outbound', protocol: ['AMQP'], description: 'Message consumption' },
    ],
    ai: {
      context: 'This is a message queue. Consider message ordering, delivery guarantees, and dead letter queue handling.',
      reviewHints: ['Verify message ordering requirements', 'Check DLQ monitoring', 'Consider message schema evolution'],
    },
  },
};

const eventBus: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'event-bus',
    namespace: 'messaging',
    version: '1.0.0',
    displayName: 'Event Bus',
    description: 'A publish-subscribe event bus for decoupled event-driven communication.',
    icon: 'Radio',
    tags: ['messaging', 'events', 'pubsub'],
  },
  spec: {
    args: [
      { name: 'provider', type: 'enum', description: 'Event bus provider', options: ['Kafka', 'SNS/SQS', 'EventBridge', 'NATS', 'Redis Pub/Sub'], default: 'Kafka' },
      { name: 'partitions', type: 'number', description: 'Number of partitions (Kafka)', default: 6 },
      { name: 'retentionHours', type: 'number', description: 'Event retention in hours', default: 168 },
    ],
    ports: [
      { name: 'publish-in', direction: 'inbound', protocol: ['Event', 'HTTP'], description: 'Event publishing' },
      { name: 'subscribe-out', direction: 'outbound', protocol: ['Event'], description: 'Event subscription/consumption' },
    ],
    ai: {
      context: 'This is an event bus. Consider event schema versioning, ordering guarantees, and consumer group management.',
      reviewHints: ['Check event schema registry', 'Verify consumer group configuration', 'Consider exactly-once processing needs'],
    },
  },
};

const streamProcessor: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'stream-processor',
    namespace: 'messaging',
    version: '1.0.0',
    displayName: 'Stream Processor',
    description: 'A real-time stream processing engine for continuous data transformation.',
    icon: 'Activity',
    tags: ['messaging', 'streaming', 'realtime'],
  },
  spec: {
    args: [
      { name: 'engine', type: 'enum', description: 'Stream processing engine', options: ['Kafka Streams', 'Flink', 'Spark Streaming', 'Custom'], default: 'Kafka Streams' },
      { name: 'windowType', type: 'enum', description: 'Windowing strategy', options: ['tumbling', 'sliding', 'session', 'none'], default: 'tumbling' },
      { name: 'windowDuration', type: 'duration', description: 'Window duration', default: '5m' },
    ],
    ports: [
      { name: 'stream-in', direction: 'inbound', protocol: ['Kafka', 'Kinesis'], description: 'Input stream' },
      { name: 'stream-out', direction: 'outbound', protocol: ['Kafka', 'Kinesis', 'HTTP'], description: 'Processed output stream' },
    ],
    ai: {
      context: 'This is a stream processor. Consider exactly-once semantics, watermarks, late data handling, and state management.',
      reviewHints: ['Verify exactly-once processing guarantees', 'Check late data handling policy', 'Consider checkpoint interval'],
    },
  },
};

// ============================================================
// NETWORK NAMESPACE (2 nodedefs)
// ============================================================

const loadBalancer: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'load-balancer',
    namespace: 'network',
    version: '1.0.0',
    displayName: 'Load Balancer',
    description: 'Distributes incoming traffic across multiple service instances.',
    icon: 'GitFork',
    tags: ['network', 'traffic', 'scaling'],
  },
  spec: {
    args: [
      { name: 'type', type: 'enum', description: 'Load balancer type', options: ['ALB', 'NLB', 'HAProxy', 'Nginx', 'Envoy'], default: 'ALB' },
      { name: 'algorithm', type: 'enum', description: 'Routing algorithm', options: ['round-robin', 'least-connections', 'ip-hash', 'weighted'], default: 'round-robin' },
      { name: 'healthCheckPath', type: 'string', description: 'Health check endpoint', default: '/health' },
      { name: 'stickySession', type: 'boolean', description: 'Enable session affinity', default: false },
    ],
    ports: [
      { name: 'traffic-in', direction: 'inbound', protocol: ['HTTP', 'HTTPS', 'TCP'], description: 'Incoming traffic' },
      { name: 'backend-out', direction: 'outbound', protocol: ['HTTP', 'TCP'], description: 'Traffic to backend instances' },
    ],
    ai: {
      context: 'This is a load balancer. Consider health check configuration, SSL termination, and connection draining.',
      reviewHints: ['Verify health check configuration', 'Check SSL/TLS termination', 'Consider connection draining for deployments'],
    },
  },
};

const cdn: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'cdn',
    namespace: 'network',
    version: '1.0.0',
    displayName: 'CDN',
    description: 'A content delivery network for caching and serving static and dynamic content globally.',
    icon: 'Globe',
    tags: ['network', 'cdn', 'caching', 'edge'],
  },
  spec: {
    args: [
      { name: 'provider', type: 'enum', description: 'CDN provider', options: ['CloudFront', 'Cloudflare', 'Fastly', 'Akamai'], default: 'CloudFront' },
      { name: 'cacheTTL', type: 'number', description: 'Default cache TTL in seconds', default: 86400 },
      { name: 'customDomain', type: 'string', description: 'Custom domain name' },
    ],
    ports: [
      { name: 'edge-in', direction: 'inbound', protocol: ['HTTP', 'HTTPS'], description: 'Edge requests from users' },
      { name: 'origin-out', direction: 'outbound', protocol: ['HTTP', 'HTTPS'], description: 'Origin fetch on cache miss' },
    ],
    ai: {
      context: 'This is a CDN. Consider cache invalidation strategy, origin shield, and edge compute capabilities.',
      reviewHints: ['Verify cache invalidation on deploy', 'Check origin shield configuration', 'Consider edge compute for personalization'],
    },
  },
};

// ============================================================
// OBSERVABILITY NAMESPACE (2 nodedefs)
// ============================================================

const logging: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'logging',
    namespace: 'observability',
    version: '1.0.0',
    displayName: 'Logging',
    description: 'A centralized logging system for collecting, storing, and querying application logs.',
    icon: 'FileText',
    tags: ['observability', 'logging', 'debugging'],
  },
  spec: {
    args: [
      { name: 'stack', type: 'enum', description: 'Logging stack', options: ['ELK', 'Loki/Grafana', 'Datadog', 'CloudWatch', 'Custom'], default: 'ELK' },
      { name: 'retentionDays', type: 'number', description: 'Log retention in days', default: 30 },
      { name: 'structuredLogs', type: 'boolean', description: 'Use structured (JSON) logging', default: true },
    ],
    ports: [
      { name: 'logs-in', direction: 'inbound', protocol: ['Syslog', 'HTTP', 'Fluent'], description: 'Log ingestion' },
      { name: 'alerts-out', direction: 'outbound', protocol: ['HTTP', 'Email', 'Slack'], description: 'Log-based alerts' },
    ],
    ai: {
      context: 'This is a logging system. Consider log levels, structured logging format, retention policies, and alert configuration.',
      reviewHints: ['Verify structured logging is enabled', 'Check log sampling for high-volume services', 'Consider PII scrubbing in logs'],
    },
  },
};

const monitoring: NodeDef = {
  kind: 'NodeDef',
  apiVersion: 'v1',
  metadata: {
    name: 'monitoring',
    namespace: 'observability',
    version: '1.0.0',
    displayName: 'Monitoring',
    description: 'A monitoring and alerting system for tracking metrics, health, and performance.',
    icon: 'BarChart3',
    tags: ['observability', 'monitoring', 'metrics', 'alerting'],
  },
  spec: {
    args: [
      { name: 'platform', type: 'enum', description: 'Monitoring platform', options: ['Prometheus/Grafana', 'Datadog', 'New Relic', 'CloudWatch', 'Custom'], default: 'Prometheus/Grafana' },
      { name: 'scrapeInterval', type: 'duration', description: 'Metrics scrape interval', default: '15s' },
      { name: 'alertChannels', type: 'string', description: 'Alert notification channels', default: 'slack,email' },
    ],
    ports: [
      { name: 'metrics-in', direction: 'inbound', protocol: ['Prometheus', 'StatsD', 'OTLP'], description: 'Metrics ingestion' },
      { name: 'alerts-out', direction: 'outbound', protocol: ['HTTP', 'Email', 'Slack', 'PagerDuty'], description: 'Alert notifications' },
    ],
    ai: {
      context: 'This is a monitoring system. Consider SLIs/SLOs, dashboard design, alert fatigue, and on-call rotation.',
      reviewHints: ['Verify SLIs and SLOs are defined', 'Check alert thresholds for false positive rate', 'Consider runbook links in alerts'],
    },
  },
};

/**
 * All 15 built-in nodedefs, organized for loading by the RegistryManager.
 */
export const BUILTIN_NODEDEFS: NodeDef[] = [
  // Compute (4)
  service,
  functionNode,
  worker,
  apiGateway,
  // Data (4)
  database,
  cache,
  objectStorage,
  repository,
  // Messaging (3)
  messageQueue,
  eventBus,
  streamProcessor,
  // Network (2)
  loadBalancer,
  cdn,
  // Observability (2)
  logging,
  monitoring,
];
