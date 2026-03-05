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
2. **API Gateway**: Look for Kong, Nginx, Envoy, AWS API Gateway, or custom gateway configs.
3. **Message brokers**: Identify Kafka, RabbitMQ, SQS, NATS, or Redis Pub/Sub usage.
4. **Databases**: Each service may have its own database. Look for migrations, schema files, or ORM configs per service.
5. **Service discovery**: Check for Consul, etcd, or Kubernetes service definitions.
6. **Observability**: Identify logging (ELK, Loki), monitoring (Prometheus, Datadog), and tracing (Jaeger, Zipkin) components.
7. **CI/CD**: Check for pipeline configs that deploy services independently.
8. **Edge types**: Use SYNC for HTTP/gRPC calls between services, ASYNC for message queue communication, DATA_FLOW for database reads/writes.

Respond with a JSON object matching this schema:
${STANDARD_RESPONSE_SCHEMA.schemaText}

Respond ONLY with the JSON object. No markdown code fences, no explanations.`,
    },
  ],

  responseSchema: STANDARD_RESPONSE_SCHEMA,

  fewShotExamples: [MICROSERVICES_FEW_SHOT],
};
