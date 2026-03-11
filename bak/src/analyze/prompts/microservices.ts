/**
 * Microservices Prompt Template
 *
 * Specialized template for distributed systems and microservices architectures.
 * Focuses on service boundaries, inter-service communication, event-driven
 * patterns, and infrastructure components.
 */

import type { PromptTemplate } from './types';
import {
  NODE_TYPE_REGISTRY_TEXT,
  STANDARD_RESPONSE_SCHEMA,
  MICROSERVICES_FEW_SHOT,
} from './shared';

export const microservicesTemplate: PromptTemplate = {
  id: 'microservices',
  name: 'Microservices Architecture Analysis',
  description:
    'Optimized for distributed systems with multiple services. Focuses on service boundaries, inter-service communication, API gateways, and event-driven patterns.',
  tags: [
    'microservices',
    'distributed',
    'docker',
    'kubernetes',
    'k8s',
    'service-mesh',
    'api-gateway',
    'event-driven',
    'grpc',
  ],

  systemPrompt: `You are an expert distributed systems architect analyzing a codebase to infer its microservices architecture.
You specialize in breaking down complex systems into their constituent services and understanding communication patterns.

Focus areas:
- **Service boundaries**: Identify each independently deployable service. Look for separate Dockerfiles, separate package.json/go.mod/Cargo.toml per service.
- **Communication patterns**: Distinguish synchronous (REST, gRPC, GraphQL) from asynchronous (message queues, event buses, pub/sub) communication.
- **API gateway**: Look for a central routing layer (Kong, Envoy, Nginx, AWS API Gateway).
- **Service mesh**: Identify sidecar proxies, mTLS, circuit breakers (Istio, Linkerd, Envoy).
- **Data ownership**: Each service should own its data store. Identify per-service databases.
- **Event sourcing / CQRS**: Detect event-driven patterns, command/query separation.
- **Infrastructure**: Container orchestration, CI/CD pipelines, observability stack.
- **Resilience**: Circuit breakers, retries, bulkheads, health checks.

Guidelines:
- Create a separate node for each distinct service, not just one "backend" node.
- Always identify the API gateway or load balancer if present.
- Look for docker-compose.yml or Kubernetes manifests to understand service topology.
- Check for proto files (gRPC), OpenAPI specs, or GraphQL schemas for service contracts.
- Be **thorough**: Model per-service internals — handlers, sagas, repositories, and domain logic as child nodes. Also model infrastructure components (service mesh, observability, CI/CD) as dedicated nodes. A typical microservices system produces 15-50+ nodes. Prefer completeness over brevity.
- Use **parent-child relationships** (parentId) to decompose each service into its internal components (e.g., order-service → order-handler, order-saga, order-repository).
- Use **meta/canvas-ref** nodes for complex subsystems maintained by separate teams or living in separate repositories. Provide args \`{ repoUrl, ref }\` for cross-repo references or \`{ filePath }\` for local sub-architecture files.
- Respond ONLY with valid JSON matching the specified schema.`,

  analysisSteps: [
    {
      name: 'Identify Services',
      systemPrompt: '',
      userPrompt: `Analyze this distributed system codebase and identify all microservices and infrastructure components.

## Project Profile
{{projectProfile}}

${NODE_TYPE_REGISTRY_TEXT}

## Key Files
{{fileContents}}

## Few-Shot Example
Here is an example of the expected output for a microservices architecture:

**Scenario:** ${MICROSERVICES_FEW_SHOT.scenario}
**Input:** ${MICROSERVICES_FEW_SHOT.input}
**Expected Output:**
${MICROSERVICES_FEW_SHOT.output}

## Microservices-Specific Instructions
1. **Service boundaries**: Each directory with its own Dockerfile, go.mod, or package.json is likely a separate service.
2. **Per-service internals**: Model each service's internal architecture — handlers, domain logic, sagas, repositories — as **children** of the service node using parentId.
3. **API Gateway**: Look for Kong, Nginx, Envoy, AWS API Gateway, or custom gateway configs.
4. **Message brokers**: Identify Kafka, RabbitMQ, SQS, NATS, or Redis Pub/Sub usage.
5. **Databases**: Each service may have its own database. Look for migrations, schema files, or ORM configs per service.
6. **Service discovery**: Check for Consul, etcd, or Kubernetes service definitions.
7. **Observability**: Identify logging (ELK, Loki), monitoring (Prometheus, Datadog), and tracing (Jaeger, Zipkin) as dedicated nodes.
8. **CI/CD**: Check for pipeline configs that deploy services independently.
9. **Edge types**: Use SYNC for HTTP/gRPC calls between services, ASYNC for message queue communication, DATA_FLOW for database reads/writes.
10. **Composite subsystems**: Use **meta/canvas-ref** for services owned by separate teams or living in separate git repos. Reference them with \`{ repoUrl, ref }\` args.

## Depth Guidelines
- Model **all architecturally significant components**, including per-service internals and infrastructure. A typical microservices system has 15-50+ nodes.
- Use **parentId** to nest internal components under their owning service.
- Prefer completeness over brevity, but don't create dummy or placeholder nodes.

Respond with a JSON object matching this schema:
${STANDARD_RESPONSE_SCHEMA.schemaText}

Respond ONLY with the JSON object. No markdown code fences, no explanations.`,
    },
  ],

  responseSchema: STANDARD_RESPONSE_SCHEMA,

  fewShotExamples: [MICROSERVICES_FEW_SHOT],
};
