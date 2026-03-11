/**
 * Data Pipeline Prompt Template
 *
 * Specialized template for ETL, data processing, and analytics systems.
 * Focuses on data flow patterns, storage tiers, orchestration, and
 * transformation stages.
 */

import type { PromptTemplate } from './types';
import {
  NODE_TYPE_REGISTRY_TEXT,
  STANDARD_RESPONSE_SCHEMA,
  DATA_PIPELINE_FEW_SHOT,
} from './shared';

export const dataPipelineTemplate: PromptTemplate = {
  id: 'data-pipeline',
  name: 'Data Pipeline Analysis',
  description:
    'Optimized for ETL, data processing, and analytics systems. Focuses on data flow, storage tiers, orchestration, and transformation stages.',
  tags: [
    'data',
    'etl',
    'pipeline',
    'analytics',
    'warehouse',
    'data-engineering',
    'airflow',
    'spark',
    'flink',
    'dbt',
    'kafka',
    'streaming',
  ],

  systemPrompt: `You are an expert data engineer analyzing a codebase to infer its data pipeline architecture.
You specialize in ETL/ELT systems, data warehouses, streaming platforms, and analytics infrastructure.

Focus areas:
- **Data sources**: Identify where data originates (databases, APIs, file uploads, event streams).
- **Ingestion**: How data enters the pipeline (batch, streaming, CDC, webhooks).
- **Transformation**: Data transformation logic (dbt, Spark, pandas, SQL, custom code).
- **Storage tiers**: Raw/landing zone, processed/staging, curated/warehouse, archive.
- **Orchestration**: Job scheduling and DAG management (Airflow, Dagster, Prefect, cron).
- **Streaming**: Real-time processing (Kafka, Flink, Kinesis, Spark Streaming).
- **Analytics**: BI tools, dashboards, reporting, ML feature stores.
- **Data quality**: Validation, testing, monitoring, alerting.

Guidelines:
- Use DATA_FLOW edge type for data movement between pipeline stages.
- Use SYNC for orchestrator-to-task triggers.
- Use ASYNC for event-driven ingestion.
- Identify the data flow direction clearly (source → sink).
- Distinguish batch from streaming paths.
- Be **thorough**: Don't just model the orchestrator — model individual pipeline stages (extractors, transformers, loaders), each data source and sink, quality checks, and monitoring as separate nodes. A typical data pipeline produces 15-50+ nodes. Prefer completeness over brevity.
- Use **parent-child relationships** (parentId) to decompose complex pipelines into their individual stages (e.g., etl-pipeline → extractor, transformer, loader as children).
- Use **meta/canvas-ref** nodes for complex sub-pipelines or shared data infrastructure maintained separately. Provide args \`{ filePath }\` for local references or \`{ repoUrl, ref }\` for remote git repositories.
- Respond ONLY with valid JSON matching the specified schema.`,

  analysisSteps: [
    {
      name: 'Data Pipeline Architecture Analysis',
      systemPrompt: '',
      userPrompt: `Analyze this data pipeline codebase and infer its architecture.

## Project Profile
{{projectProfile}}

${NODE_TYPE_REGISTRY_TEXT}

## Key Files
{{fileContents}}

## Few-Shot Example
Here is an example of the expected output for a data pipeline:

**Scenario:** ${DATA_PIPELINE_FEW_SHOT.scenario}
**Input:** ${DATA_PIPELINE_FEW_SHOT.input}
**Expected Output:**
${DATA_PIPELINE_FEW_SHOT.output}

## Data Pipeline-Specific Instructions
1. **Sources**: Identify all data sources (operational databases, APIs, file drops, event streams) as individual nodes.
2. **Ingestion layer**: Look for Kafka consumers, S3 event triggers, API polling, CDC (Debezium).
3. **Processing**: Identify Spark jobs, Flink operators, dbt models, pandas scripts, or SQL transformations. Model individual stages (extractor, transformer, loader) as **children** of the pipeline node using parentId.
4. **Orchestration**: Look for Airflow DAGs, Dagster assets, Prefect flows, or cron configurations. Model individual DAG tasks as children when visible.
5. **Storage**: Identify data lake (S3/GCS), data warehouse (Snowflake, BigQuery, ClickHouse, Redshift), and feature stores — each as a separate node.
6. **Serving**: Look for analytics dashboards (Grafana, Metabase), REST APIs serving data, or ML model endpoints.
7. **Edge types**: Use DATA_FLOW for data movement, SYNC for orchestrator triggers, ASYNC for event-driven flows.
8. **Data quality**: Check for Great Expectations, dbt tests, or custom validation logic. Model as dedicated nodes.
9. **Composite sub-pipelines**: Use **meta/canvas-ref** for complex sub-pipelines or shared data infrastructure maintained in separate repos. Reference with \`{ repoUrl, ref }\` or \`{ filePath }\` args.

## Depth Guidelines
- Model **every pipeline stage individually**, not just the orchestrator. A typical data pipeline has 15-50+ nodes.
- Use **parentId** to nest stages under their parent pipeline (e.g., etl-pipeline → extractor, transformer, loader).
- Prefer completeness over brevity, but don't create dummy or placeholder nodes.

Respond with a JSON object matching this schema:
${STANDARD_RESPONSE_SCHEMA.schemaText}

Respond ONLY with the JSON object. No markdown code fences, no explanations.`,
    },
  ],

  responseSchema: STANDARD_RESPONSE_SCHEMA,

  fewShotExamples: [DATA_PIPELINE_FEW_SHOT],
};
