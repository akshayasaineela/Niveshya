# Overview

Solaris is a conversational business intelligence system that allows users to generate interactive dashboards using natural language queries.

Instead of writing SQL or configuring BI tools manually, users simply ask a question in plain English. The system automatically:

1.Interprets the query using an AI model.  
2.Generates a valid SQL query  
3.Executes the query on a database  
4.Selects the appropriate visualization  
5.Displays an interactive dashboard in real time  

The platform enables non-technical users to analyze data instantly, eliminating dependency on data analysts or complex BI software.  

# Problem Statement

Organizations generate large volumes of data but extracting insights often requires technical expertise.

Typical challenges include:

->Business users lack SQL knowledge

->Analysts become bottlenecks for reporting

->Traditional BI tools require training

->Decision-making becomes slow due to delayed insights

Solaris addresses this gap by enabling natural language driven analytics, allowing users to interact with data conversationally.


# Key Features

## Natural Language Query Interface
Users can ask analytical questions in plain English.  
The system converts the question into an executable SQL query.  

## Automated SQL Generation
The AI model generates structured SQL queries using the database schema.

*Example:*
SELECT Channel_Used, SUM(Revenue) AS Total_Revenue
FROM marketing_campaigns
GROUP BY Channel_Used
ORDER BY Total_Revenue DESC;


## Intelligent Visualization Selection

Solaris automatically selects the most suitable chart based on the query.

## Conversational Dashboard Refinement

Users can refine dashboards with follow-up queries.

*Example flow:*
User: Show revenue by channel
System: Displays bar chart

User: Now show only social media campaigns
System: Updates dashboard with filtered data

This allows iterative exploration of insights.

# CSV Dataset Upload

Users can upload custom datasets.

Workflow:

1.Upload CSV file  
2.System parses dataset using Papa Parse  
3.A new SQLite table is generated dynamically  
4.Users can query the uploaded dataset immediately  


# RAG-Enhanced Schema Retrieval

Solaris incorporates a lightweight Retrieval Augmented Generation (RAG) mechanism to improve SQL generation accuracy.

Instead of sending the entire database schema to the AI model, the system retrieves only the relevant tables and columns related to the query.

Benefits include:

->Reduced hallucinations  
->More accurate SQL generation  
->Better scalability for larger databases  


# System Architecture

User Query  -->  RAG Retrieval Layer (Schema & Metadata)  -->   Large Language Model (Natural Language → SQL)  -->  SQLite Database (sql.js)  --> Query Result  -->  Visualization Engine (Recharts)  --> Interactive Dashboard 

# Technology Stack
## Frontend

React
Tailwind CSS
Framer Motion

## Data Processing

SQLite (via sql.js running in WebAssembly)
Papa Parse (CSV ingestion)

## Visualization

Recharts

## AI Integration

OpenRouter API
DeepSeek Chat model

## Retrieval Layer

Lightweight RAG implementation for schema retrieval
